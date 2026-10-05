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
  const bar = ["#d62a2a", "#dcc72b", "#3cb54a", "#2ea3e6"]
    .map((c) => `<td style="height:4px;background:${c};font-size:0;line-height:0">&nbsp;</td>`).join("");
  return `<div style="background:#f6f8f7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bar}</tr></table></td></tr>
<tr><td style="padding:20px 28px 8px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#237d32">${escape(`${EVENT.name} · ${EVENT.programme}`.toUpperCase())}</td></tr>
<tr><td style="padding:8px 28px 24px;font-size:14px;line-height:1.65;color:#0f1b2d;white-space:pre-line">${escape(text)}</td></tr>
<tr><td style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">${escape(EVENT.organiser)} · This is an automated message from the ${escape(EVENT.name)} ${escape(EVENT.short)} portal.</td></tr>
</table></div>`;
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

export const sellerMail = {
  received: (name: string, regNo: string, district: string, username: string, password: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — seller registration received (${regNo})`,
    text: `Dear ${name},

Thank you for registering as a seller for ${EVENT.name} ${EVENT.programme}.

Your registration number: ${regNo}

Your details will be verified by the District Industries Centre, ${district}, and recommended to the Directorate of Industries & Commerce.

Temporary login to track your application:
User name: ${username}
Password: ${password}

Sign in at ${APP_URL}/login to see the status of your application. If the District Industries Centre asks for a correction, you can correct your details and resubmit them with this login. Once the Directorate approves your registration, the same login becomes your permanent seller login.${signature}`,
  }),
  /** Applicant login given when a district office sends an application back for correction. */
  sentBack: (name: string, regNo: string, district: string, comment: string, login: { username: string; password: string | null }) => ({
    subject: `${EVENT.name} ${EVENT.short} — please correct your seller registration (${regNo})`,
    text: `Dear ${name},

The District Industries Centre, ${district}, has returned your seller registration ${regNo} for correction:

"${comment}"

Please sign in at ${APP_URL}/login, correct the details and resubmit them to the district centre.
${login.password ? `
User name: ${login.username}
Password: ${login.password}
(You will be asked to set your own password when you sign in.)` : `
User name: ${login.username} (use the password you have set)`}${signature}`,
  }),
  approved: (name: string, approvedNo: string, username: string, password: string | null) => ({
    subject: `${EVENT.name} ${EVENT.short} — seller registration approved (${approvedNo})`,
    text: `Dear ${name},

We are pleased to inform you that your registration has been approved by the Directorate of Industries & Commerce and you have been added to the ${EVENT.short} seller list.

Your seller number: ${approvedNo}

${password ? `Your login credentials:
User name: ${username}
Password: ${password}

Sign in at ${APP_URL}/login. You will be asked to change your password on first login.` : `Your login (${username}) is now your permanent seller login. Sign in at ${APP_URL}/login with the password you have set to see your full seller dashboard.`}

Next step: please complete your seller profile (promoter and unit details) from "My profile" in the portal. It is needed before you can send your buyer preferences. Buyer meeting details will be shared through the portal.${signature}`,
  }),
  rejected: (name: string, regNo: string, comment: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — seller registration ${regNo} not accepted`,
    text: `Dear ${name},

Your seller registration ${regNo} could not be accepted, for the following reason:

"${comment}"

For clarification, please contact your District Industries Centre.${signature}`,
  }),
};

export const matchMail = {
  published: (name: string, who: "buyer" | "seller", count: number, updated: boolean) => ({
    subject: `${EVENT.name} ${EVENT.short} — your B2B matchmaking ${updated ? "has been updated" : "is ready"}`,
    text: `Dear ${name},

The Directorate of Industries & Commerce has ${updated ? "updated" : "published"} the buyer–seller matchmaking for ${EVENT.name} ${EVENT.programme}.

You have been matched with ${count} ${who === "buyer" ? "Kerala MSME seller" : "international buyer"}${count === 1 ? "" : "s"} for one-to-one B2B meetings.

Sign in at ${APP_URL}/login to see the details. Meeting schedules will be shared through the portal.${signature}`,
  }),
};

export const commsMail = {
  /** A new message in a conversation (the text itself is read on the portal). */
  message: (name: string, from: string, where: string, link: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — new message from ${from}`,
    text: `Dear ${name},

You have a new message from ${from} in "${where}" on the ${EVENT.short} portal.

Sign in to read and reply: ${APP_URL}${link}${signature}`,
  }),
  announcement: (name: string, from: string, subject: string, link: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — ${subject}`,
    text: `Dear ${name},

${from} has sent you a communication: "${subject}".

Sign in to read it and any documents shared: ${APP_URL}${link}${signature}`,
  }),
};
