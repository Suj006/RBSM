import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { APP_URL, EVENT } from "@/lib/config";

let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  transporter = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  return transporter;
}

export const isMailConfigured = () => Boolean(process.env.SMTP_HOST);

/**
 * Sends an e-mail and records it in the outbox. Never throws: a mail failure
 * must not undo the registration or review action that triggered it.
 */
export async function sendMail(to: string, subject: string, text: string) {
  const t = getTransporter();
  let status: "SENT" | "LOGGED" | "FAILED" = "LOGGED";
  let error: string | undefined;
  if (t) {
    try {
      await t.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html: toHtml(text) });
      status = "SENT";
    } catch (e) {
      status = "FAILED";
      error = e instanceof Error ? e.message : String(e);
      console.error("[mail] failed", to, subject, error);
    }
  } else {
    console.info(`[mail:outbox] to=${to} subject=${subject}\n${text}`);
  }
  await prisma.emailLog.create({ data: { to, subject, body: text, status, error } });
  return status;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function toHtml(text: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;max-width:560px">
<div style="background:#0b1f3a;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;font-weight:bold">${EVENT.name} · ${EVENT.programme}</div>
<div style="border:1px solid #e2e8f0;border-top:0;padding:20px;border-radius:0 0 8px 8px;white-space:pre-line">${escape(text)}</div>
</div>`;
}

const signature = `\n\nRegards,\n${EVENT.name} ${EVENT.short} Secretariat\n${APP_URL}`;

export const mailTemplates = {
  credentials: (name: string, username: string, password: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — your buyer login credentials`,
    text: `Dear ${name},

Thank you for signing up for ${EVENT.name} ${EVENT.programme}.

Your login credentials:
User name: ${username}
Password: ${password}

Sign in at ${APP_URL}/login. You will be asked to change your password on first login and then to complete your basic details.${signature}`,
  }),
  basicApproved: (name: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — basic details approved`,
    text: `Dear ${name},

Your basic registration details have been approved by FIEO. Please sign in and complete your detailed sourcing requirement.${signature}`,
  }),
  returned: (name: string, what: string, comment: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — ${what} returned for correction`,
    text: `Dear ${name},

Your ${what} has been returned for correction with the following comment:

"${comment}"

Please sign in, update the details and submit again.${signature}`,
  }),
  sectorsReturned: (name: string, items: { sector: string; comment: string }[]) => ({
    subject: `${EVENT.name} ${EVENT.short} — requirement returned for correction`,
    text: `Dear ${name},

FIEO has returned the following sector requirement${items.length > 1 ? "s" : ""} for correction:

${items.map((i) => `• ${i.sector}: "${i.comment}"`).join("\n")}

Please sign in, update ${items.length > 1 ? "them" : "it"} and submit again. Your other sectors are not affected.${signature}`,
  }),
  sectorsApproved: (name: string, approvedNo: string, sectors: string[], firstTime: boolean) => ({
    subject: firstTime
      ? `${EVENT.name} ${EVENT.short} — registration approved (${approvedNo})`
      : `${EVENT.name} ${EVENT.short} — sector requirement approved`,
    text: `Dear ${name},

${firstTime
  ? `We are pleased to inform you that your registration has been approved by the Directorate and you have been added to the ${EVENT.short} buyer list.

Your buyer number: ${approvedNo}

`
  : ""}The following sector requirement${sectors.length > 1 ? "s have" : " has"} been approved:
${sectors.map((s) => `• ${s}`).join("\n")}

You can add new sectors or modify approved ones at any time from your dashboard; changes go through the same approval.${signature}`,
  }),
  approved: (name: string, approvedNo: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — registration approved (${approvedNo})`,
    text: `Dear ${name},

We are pleased to inform you that your registration has been approved by the Directorate and you have been added to the ${EVENT.short} buyer list.

Your buyer number: ${approvedNo}

Further details on matchmaking and B2B meeting schedules will follow.${signature}`,
  }),
};
