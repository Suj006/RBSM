"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBuyer, requireUser } from "@/lib/auth";
import { englishText, firstErrors } from "@/lib/text";
import { MOU_RATE_KEY, mouNumber, mouPartners } from "@/lib/mou";
import { mouMail, sendMail } from "@/lib/mail";
import { nextSeq } from "@/lib/sequence";
import type { FormState } from "./auth";

const revalidateAll = () => { for (const p of ["/buyer", "/seller", "/nodal", "/fieo", "/dic", "/admin"]) revalidatePath(p, "layout"); };

const mouSchema = z.object({
  sellerId: z.string().min(1, "Choose the seller."),
  sectorId: z.string().min(1, "Choose the sector."),
  goods: englishText({ min: 3, max: 600, label: "Description of goods", multiline: true }),
  currency: z.enum(["USD", "INR"], { message: "Choose US$ or INR." }),
  tbd: z.boolean(),
  amount: z.string(),
  orderMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose the approximate month of placing the order."),
}).transform((d, ctx) => {
  let amount: number | null = null;
  if (!d.tbd) {
    amount = Number(d.amount.replace(/[, ]/g, ""));
    if (!d.amount.trim() || !Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter the approximate value as a number, or tick 'To be determined'." });
      return z.NEVER;
    }
  }
  return { ...d, amount };
});

/** Buyer: fill an MoU after a successful meeting (or correct and resubmit a returned one). */
export async function saveMouAction(_: FormState, form: FormData): Promise<FormState> {
  const { user, buyer } = await requireBuyer();
  if (buyer.status !== "APPROVED" || !buyer.approvedSeq) return { error: "MoUs open once you are an approved buyer." };
  const raw = Object.fromEntries(["mouId", "sellerId", "sectorId", "goods", "currency", "amount", "orderMonth"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = mouSchema.safeParse({ ...raw, tbd: form.get("tbd") === "on" });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), error: "Please correct the highlighted fields.", data: raw };
  const d = parsed.data;
  // Earliest month allowed: the current one.
  const now = new Date();
  if (d.orderMonth < `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`) return { fieldErrors: { orderMonth: "The month cannot be in the past." }, data: raw };
  const partner = (await mouPartners(buyer.id)).find((p) => p.id === d.sellerId);
  if (!partner || !partner.approvedSeq) return { fieldErrors: { sellerId: "Choose one of your matched sellers." }, data: raw };
  if (!partner.commonSectors.some((s) => s.id === d.sectorId) && !partner.products.some((p) => p.sectorId === d.sectorId)) return { fieldErrors: { sectorId: "Choose a sector of this seller." }, data: raw };
  const fields = { sellerId: d.sellerId, sectorId: d.sectorId, goods: d.goods, currency: d.currency, amount: d.amount, orderMonth: d.orderMonth, meetingId: partner.meeting?.id ?? null };

  if (raw.mouId) {
    const m = await prisma.mou.findFirst({ where: { id: raw.mouId, buyerId: buyer.id } });
    if (!m) return { error: "MoU not found." };
    if (m.status !== "RETURNED" && m.status !== "SUBMITTED") return { error: "This MoU can no longer be changed." };
    if (m.sellerId !== d.sellerId) return { error: "The seller of an MoU cannot be changed — withdraw it and fill a new one." };
    await prisma.mou.update({ where: { id: m.id }, data: { ...fields, status: "SUBMITTED", submittedAt: new Date(), nodalVerifiedAt: null, nodalVerifiedById: null, fieoApprovedAt: null, fieoApprovedById: null } });
    revalidateAll();
    return { ok: true, message: `${m.mouNo} submitted again for verification.`, data: { mouId: m.id } };
  }
  const m = await prisma.$transaction(async (tx) => {
    const prior = await tx.mou.count({ where: { buyerId: buyer.id, sellerId: d.sellerId } });
    const seq = await nextSeq(tx, "mou");
    return tx.mou.create({ data: { ...fields, buyerId: buyer.id, seq, mouNo: mouNumber(buyer.approvedSeq!, partner.approvedSeq!, prior + 1) } });
  });
  void user;
  revalidateAll();
  return { ok: true, message: `MoU ${m.mouNo} submitted. The nodal officer and FIEO will verify it; you will see it here as approved.`, data: { mouId: m.id } };
}

/** Buyer: withdraw an MoU not yet approved. */
export async function withdrawMouAction(_: FormState, form: FormData): Promise<FormState> {
  const { buyer } = await requireBuyer();
  const m = await prisma.mou.findFirst({ where: { id: String(form.get("mouId") ?? ""), buyerId: buyer.id } });
  if (!m || (m.status !== "SUBMITTED" && m.status !== "RETURNED")) return { error: "This MoU cannot be withdrawn." };
  await prisma.mou.update({ where: { id: m.id }, data: { status: "WITHDRAWN" } });
  revalidateAll();
  return { ok: true, message: `${m.mouNo} withdrawn.` };
}

/**
 * Nodal officer (own buyers) or Directorate: verify. FIEO: approve. Either may return it to the buyer with a comment.
 * The MoU is approved — and shown to the seller — once it is both verified and approved.
 */
export async function reviewMouAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["NODAL", "FIEO", "DIC"]);
  const op = String(form.get("op"));
  const m = await prisma.mou.findUnique({ where: { id: String(form.get("mouId") ?? "") },
    include: { buyer: { select: { name: true, pocEmail: true, signupEmail: true, nodalOfficer: { select: { userId: true } } } }, seller: { select: { name: true, contactEmail: true } } } });
  if (!m) return { error: "MoU not found." };
  if (user.role === "NODAL" && m.buyer.nodalOfficer?.userId !== user.id) return { error: "This MoU is of a buyer assigned to another nodal officer." };
  if (m.status !== "SUBMITTED") return { error: "This MoU is not awaiting verification." };
  const now = new Date();
  if (op === "return") {
    const comment = String(form.get("comment") ?? "").trim();
    if (comment.length < 5) return { fieldErrors: { comment: "Say what the buyer should correct." } };
    await prisma.mou.update({ where: { id: m.id }, data: { status: "RETURNED", returnComment: comment.slice(0, 1000), returnedAt: now, returnedById: user.id, nodalVerifiedAt: null, nodalVerifiedById: null, fieoApprovedAt: null, fieoApprovedById: null } });
    const mail = mouMail.returned(m.buyer.name, m.mouNo, comment);
    await sendMail(m.buyer.pocEmail || m.buyer.signupEmail, mail.subject, mail.text);
    revalidateAll();
    return { ok: true, message: `${m.mouNo} returned to the buyer.` };
  }
  let data: { nodalVerifiedAt?: Date; nodalVerifiedById?: string; fieoApprovedAt?: Date; fieoApprovedById?: string };
  if (op === "verify" && (user.role === "NODAL" || user.role === "DIC")) {
    if (m.nodalVerifiedAt) return { error: "Already verified." };
    data = { nodalVerifiedAt: now, nodalVerifiedById: user.id };
  } else if (op === "approve" && user.role === "FIEO") {
    if (m.fieoApprovedAt) return { error: "Already approved by FIEO." };
    data = { fieoApprovedAt: now, fieoApprovedById: user.id };
  } else return { error: "Not allowed." };
  const done = !!(m.nodalVerifiedAt || data.nodalVerifiedAt) && !!(m.fieoApprovedAt || data.fieoApprovedAt);
  await prisma.mou.update({ where: { id: m.id }, data: { ...data, ...(done ? { status: "APPROVED", approvedAt: now } : {}) } });
  if (done) {
    const b = mouMail.approved(m.buyer.name, m.mouNo, m.seller.name, `/buyer/mou/${m.id}`);
    await sendMail(m.buyer.pocEmail || m.buyer.signupEmail, b.subject, b.text);
    const s = mouMail.approved(m.seller.name, m.mouNo, m.buyer.name, `/seller/mou/${m.id}`);
    await sendMail(m.seller.contactEmail, s.subject, s.text);
  }
  revalidateAll();
  return { ok: true, message: done ? `${m.mouNo} approved — now with the buyer and the seller.` : op === "verify" ? `${m.mouNo} verified — awaiting FIEO approval.` : `${m.mouNo} approved by FIEO — awaiting the nodal officer's verification.` };
}

/** Directorate: the US$ → INR rate used to show MoU values in both currencies. */
export async function setMouRateAction(_: FormState, form: FormData): Promise<FormState> {
  await requireUser("DIC");
  const v = Number(String(form.get("rate") ?? "").trim());
  if (!Number.isFinite(v) || v < 10 || v > 500) return { fieldErrors: { rate: "Enter the rate, e.g. 88.25." } };
  await prisma.matchSetting.upsert({ where: { key: MOU_RATE_KEY }, create: { key: MOU_RATE_KEY, value: String(v) }, update: { value: String(v) } });
  revalidateAll();
  return { ok: true, message: `Rate set: 1 US$ = ₹ ${v}.` };
}
