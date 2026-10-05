"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMatchState } from "@/lib/matchmaking";
import {
  AUDIENCES, ensureConversation, getViewer, isPublishedPair, markConversationRead, matchedSellersOf, postBlock, resolveAudience,
  type Audience, type Viewer,
} from "@/lib/comms";
import { commsMail, sendMail } from "@/lib/mail";
import { MAX_SHARED_FILES, storeShared, validateShared } from "@/lib/storage";
import { englishText, firstErrors } from "@/lib/text";
import { DISTRICT_NAMES } from "@/lib/config";
import type { FormState } from "./auth";

const revalidateAll = () => {
  for (const p of ["/dic", "/fieo", "/admin", "/buyer", "/seller"]) revalidatePath(p, "layout");
};

const bodyField = englishText({ max: 5000, label: "Message", multiline: true });
const docName = englishText({ min: 2, max: 120, label: "Document name" });

/** Shared documents from the form: file-0 / docName-0 … Each needs a name. */
async function readDocs(form: FormData): Promise<{ error?: string; fieldErrors?: Record<string, string>; docs: { file: File; name: string }[] }> {
  const docs: { file: File; name: string }[] = [];
  const fieldErrors: Record<string, string> = {};
  for (let i = 0; i < MAX_SHARED_FILES; i++) {
    const file = form.get(`file-${i}`);
    const rawName = String(form.get(`docName-${i}`) ?? "");
    const has = file instanceof File && file.size > 0;
    if (!has && !rawName.trim()) continue;
    if (!has) { fieldErrors[`file-${i}`] = "Choose the file for this document."; continue; }
    const bad = validateShared(file);
    if (bad) { fieldErrors[`file-${i}`] = bad; continue; }
    if (!rawName.trim()) { fieldErrors[`docName-${i}`] = "Enter the document name."; continue; }
    const n = docName.safeParse(rawName);
    if (!n.success || !n.data) { fieldErrors[`docName-${i}`] = n.success ? "Enter the document name." : n.error.issues[0].message; continue; }
    docs.push({ file, name: n.data });
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Please check the documents.", docs: [] };
  return { docs };
}

async function saveDocs(docs: { file: File; name: string }[], folder: string) {
  const out = [];
  for (const d of docs) {
    const s = await storeShared(d.file, folder);
    out.push({ name: d.name, originalName: d.file.name.slice(0, 200), ...s });
  }
  return out;
}

const roleOrg = (v: Viewer) => (v.user.role === "DIC" ? "the Directorate" : v.user.role === "FIEO" ? "FIEO" : v.buyerName ?? v.sellerName ?? v.user.displayName);

/** Post a message: in an existing conversation, a buyer–seller pair, or a programme desk. */
export async function sendMessageAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["BUYER", "SELLER", "DIC", "FIEO", "ADMIN"]);
  const v = await getViewer(user);
  const pb = bodyField.safeParse(String(form.get("body") ?? ""));
  if (!pb.success) return { fieldErrors: { body: pb.error.issues[0].message } };
  const docs = await readDocs(form);
  if (docs.error) return { error: docs.error, fieldErrors: docs.fieldErrors };
  if (!pb.data && !docs.docs.length) return { fieldErrors: { body: "Write a message or share a document." } };

  // Which conversation
  const target = String(form.get("target") ?? "");
  let buyerId: string | null = null, sellerId: string | null = null;
  let kind: "BUYER_SELLER" | "DESK_BUYER" | "DESK_SELLER";
  if (target === "conversation") {
    const c = await prisma.conversation.findUnique({ where: { id: String(form.get("conversationId") ?? "") } });
    if (!c) return { error: "Conversation not found." };
    ({ buyerId, sellerId, kind } = c);
  } else if (target === "pair") {
    kind = "BUYER_SELLER";
    buyerId = v.buyerId ?? String(form.get("buyerId") ?? "");
    sellerId = v.sellerId ?? String(form.get("sellerId") ?? "");
  } else if (target === "desk") {
    if (v.buyerId) { kind = "DESK_BUYER"; buyerId = v.buyerId; }
    else if (v.sellerId) { kind = "DESK_SELLER"; sellerId = v.sellerId; }
    else if (v.staff && form.get("buyerId")) { kind = "DESK_BUYER"; buyerId = String(form.get("buyerId")); }
    else if (v.staff && form.get("sellerId")) { kind = "DESK_SELLER"; sellerId = String(form.get("sellerId")); }
    else return { error: "Choose a buyer or a seller." };
  } else return { error: "Unknown conversation." };

  // Access: participants only in their own conversations
  if (!v.staff && !v.admin) {
    if (v.buyerId && buyerId !== v.buyerId) return { error: "Not allowed." };
    if (v.sellerId && sellerId !== v.sellerId) return { error: "Not allowed." };
    if (!v.buyerId && !v.sellerId) return { error: "Not allowed." };
    if (kind === "DESK_BUYER" && !v.buyerId) return { error: "Not allowed." };
    if (kind === "DESK_SELLER" && !v.sellerId) return { error: "Not allowed." };
  }
  const [buyer, seller, state] = await Promise.all([
    buyerId ? prisma.buyer.findUnique({ where: { id: buyerId }, select: { id: true, name: true, userId: true, signupEmail: true, pocEmail: true, status: true } }) : null,
    sellerId ? prisma.seller.findUnique({ where: { id: sellerId }, select: { id: true, name: true, userId: true, contactEmail: true, status: true } }) : null,
    getMatchState(),
  ]);
  if ((buyerId && !buyer) || (sellerId && !seller)) return { error: "Buyer or seller not found." };
  if (kind === "DESK_SELLER" && seller?.status !== "APPROVED") return { error: "Only approved sellers can be written to." };
  const existing = await prisma.conversation.findFirst({ where: { kind, buyerId, sellerId } });
  const published = kind === "BUYER_SELLER" ? await isPublishedPair(buyerId!, sellerId!) : true;
  if (kind === "BUYER_SELLER" && !existing && !published) return { error: "This buyer and seller are not matched in the published mapping." };
  const block = postBlock(v, { kind, closed: existing?.closed ?? false }, { interaction: state.interaction, published });
  if (block) return { error: block };

  const conv = existing ?? await ensureConversation(kind, buyerId, sellerId);
  let saved;
  try { saved = await saveDocs(docs.docs, `comms/${conv.id}`); } catch (e) { return { error: e instanceof Error ? e.message : "The document could not be saved." }; }
  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conv.id, authorId: user.id, authorRole: user.role, body: pb.data, createdAt: now, attachments: { create: saved } } }),
    prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now } }),
  ]);
  await markConversationRead(conv.id, user.id);

  // E-mail the buyer / seller on the other side (staff read the portal).
  const where = kind === "BUYER_SELLER" ? `${buyer!.name} – ${seller!.name}` : "Programme desk";
  const notify: { name: string; email: string; link: string }[] = [];
  if (buyer && user.role !== "BUYER") notify.push({ name: buyer.name, email: buyer.pocEmail || buyer.signupEmail, link: kind === "BUYER_SELLER" ? `/buyer/messages/seller/${seller!.id}` : "/buyer/messages/desk" });
  if (seller && user.role !== "SELLER") notify.push({ name: seller.name, email: seller.contactEmail, link: kind === "BUYER_SELLER" ? `/seller/messages/buyer/${buyer!.id}` : "/seller/messages/desk" });
  for (const n of notify) { const m = commsMail.message(n.name, roleOrg(v), where, n.link); await sendMail(n.email, m.subject, m.text); }

  revalidateAll();
  return { ok: true, message: "Message sent.", data: { conversationId: conv.id } };
}

/** Staff: send to one buyer / seller, which opens (or continues) their programme-desk conversation. */
export async function staffDirectAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["DIC", "FIEO"]);
  const r = await sendMessageAction(undefined, form);
  if (!r?.ok) return r;
  const base = user.role === "DIC" ? "/dic" : "/fieo";
  redirect(`${base}/messages/c/${r.data!.conversationId}?sent=1`);
}

const announcementSchema = z.object({
  subject: englishText({ min: 3, max: 160, label: "Subject" }),
  body: englishText({ min: 2, max: 8000, label: "Message", multiline: true }),
});

/** A common communication: staff to a group, or a buyer to all its matched sellers. */
export async function sendAnnouncementAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["BUYER", "DIC", "FIEO"]);
  const v = await getViewer(user);
  const p = announcementSchema.safeParse({ subject: String(form.get("subject") ?? ""), body: String(form.get("body") ?? "") });
  if (!p.success) return { fieldErrors: firstErrors(p.error), error: "Please correct the highlighted fields." };
  const docs = await readDocs(form);
  if (docs.error) return { error: docs.error, fieldErrors: docs.fieldErrors };

  let audience: string, audienceLabel: string, recipients: { userId: string; email: string; name: string }[];
  if (user.role === "BUYER") {
    if (!v.buyerId) return { error: "Not allowed." };
    const state = await getMatchState();
    if (!state.interaction) return { error: "Communications to sellers open once the Directorate enables buyer–seller interaction." };
    recipients = await matchedSellersOf(v.buyerId);
    audience = "BUYER_MATCHED_SELLERS"; audienceLabel = `All matched sellers of ${v.buyerName}`;
  } else {
    const a = String(form.get("audience") ?? "") as Audience;
    if (!AUDIENCES.some((x) => x.value === a) || a === "ONE_BUYER" || a === "ONE_SELLER") return { fieldErrors: { audience: "Choose who receives it." } };
    const sectorId = String(form.get("sectorId") ?? "") || undefined;
    const district = String(form.get("district") ?? "") || undefined;
    if (district && !DISTRICT_NAMES.includes(district)) return { fieldErrors: { district: "Choose a district." } };
    recipients = await resolveAudience(a, { sectorId, district });
    const sector = sectorId ? await prisma.sector.findUnique({ where: { id: sectorId }, select: { name: true } }) : null;
    audience = a;
    audienceLabel = [AUDIENCES.find((x) => x.value === a)!.label, sector && `sector: ${sector.name}`, district && `district: ${district}`].filter(Boolean).join(" · ");
  }
  const unique = [...new Map(recipients.map((r) => [r.userId, r])).values()];
  if (!unique.length) return { error: "No one matches this selection." };

  const ann = await prisma.announcement.create({
    data: { authorId: user.id, authorRole: user.role, buyerId: user.role === "BUYER" ? v.buyerId : null, audience, audienceLabel, subject: p.data.subject, body: p.data.body,
      recipients: { create: unique.map((r) => ({ userId: r.userId })) } },
  });
  try {
    const saved = await saveDocs(docs.docs, `announcements/${ann.id}`);
    if (saved.length) await prisma.attachment.createMany({ data: saved.map((s) => ({ ...s, announcementId: ann.id })) });
  } catch (e) {
    await prisma.announcement.delete({ where: { id: ann.id } });
    return { error: e instanceof Error ? e.message : "The document could not be saved." };
  }
  if (form.get("email") === "on" || user.role === "BUYER") {
    const roles = await prisma.user.findMany({ where: { id: { in: unique.map((r) => r.userId) } }, select: { id: true, role: true } });
    for (const r of unique) {
      const base = roles.find((x) => x.id === r.userId)?.role === "SELLER" ? "/seller" : "/buyer";
      const m = commsMail.announcement(r.name, roleOrg(v), p.data.subject, `${base}/messages/a/${ann.id}`);
      await sendMail(r.email, m.subject, m.text);
    }
  }
  revalidateAll();
  const base = user.role === "BUYER" ? "/buyer" : user.role === "DIC" ? "/dic" : "/fieo";
  redirect(`${base}/messages/a/${ann.id}?sent=${unique.length}`);
}

/** Staff: close a conversation to the participants (or reopen it). */
export async function closeConversationAction(_: FormState, form: FormData): Promise<FormState> {
  await requireUser(["DIC", "FIEO"]);
  const id = String(form.get("conversationId") ?? "");
  const close = form.get("op") === "close";
  await prisma.conversation.update({ where: { id }, data: { closed: close } });
  revalidateAll();
  return { ok: true, message: close ? "Conversation closed — the participants can read it but not write." : "Conversation reopened." };
}

/** Staff: withdraw a message (kept for the record, hidden from participants) or restore it. */
export async function hideMessageAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["DIC", "FIEO"]);
  const id = String(form.get("messageId") ?? "");
  const hide = form.get("op") === "hide";
  await prisma.message.update({ where: { id }, data: hide ? { hiddenAt: new Date(), hiddenById: user.id } : { hiddenAt: null, hiddenById: null } });
  revalidateAll();
  return { ok: true, message: hide ? "Message withdrawn." : "Message restored." };
}
