"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { approvedSellerNo, EVENT, sellerUsername } from "@/lib/config";
import { sendMail, sellerMail } from "@/lib/mail";
import { nextSeq } from "@/lib/sequence";
import { sellerSchema, type SellerData } from "@/lib/seller-schema";
import { SELLER_DISTRICT_EDITABLE } from "@/lib/status";
import { englishText, firstErrors } from "@/lib/text";
import type { Prisma } from "@/generated/prisma/client";
import { createSeller } from "@/lib/seller-create";
import type { SellerStatus } from "@/generated/prisma/enums";
import type { FormState } from "./auth";

const revalidateAll = () => {
  for (const p of ["/district", "/dic", "/fieo", "/admin", "/seller"]) revalidatePath(p, "layout");
};

const FIELDS = ["name", "district", "taluk", "localBodyType", "localBodyName", "udyamNo", "exportExperience",
  "contactName", "contactMobile", "contactWhatsapp", "contactEmail"] as const;

function readForm(form: FormData) {
  const raw: Record<string, unknown> = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "")]));
  try { raw.products = JSON.parse(String(form.get("products") ?? "[]")); } catch { raw.products = []; }
  if (form.get("sameWhatsapp") === "on") raw.contactWhatsapp = raw.contactMobile;
  return raw;
}

/** Validates sector ids against the master; returns an error message or null. */
async function checkSectors(d: SellerData) {
  const ids = d.products.map((p) => p.sectorId);
  const n = await prisma.sector.count({ where: { id: { in: ids } } });
  return n === ids.length ? null : "Select sectors from the list.";
}

// ---------------------------------------------------------------- district: add / edit

export async function saveSellerAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("DISTRICT");
  const id = String(form.get("id") ?? "") || null;
  const raw = readForm(form);
  raw.district = user.district; // a district office registers sellers of its own district only
  const parsed = sellerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error, true), error: "Please correct the highlighted fields." };
  const d = parsed.data;
  const sectorErr = await checkSectors(d);
  if (sectorErr) return { error: sectorErr };

  const dup = await prisma.seller.findUnique({ where: { udyamNo: d.udyamNo } });
  if (dup && dup.id !== id) {
    return { fieldErrors: { udyamNo: `This Udyam number is already registered (${dup.regNo}, ${dup.district}).` }, error: "Please correct the highlighted fields." };
  }
  const recommend = form.get("intent") === "recommend";

  const seller = await prisma.$transaction(async (tx) => {
    if (!id) {
      const s = await createSeller(tx, d, "DISTRICT", { id: user.id, role: "DISTRICT" });
      if (recommend) await recommendOne(tx, s.id, s.status, user.id);
      return s;
    }
    const existing = await tx.seller.findFirst({ where: { id, district: user.district! } });
    if (!existing || !SELLER_DISTRICT_EDITABLE.includes(existing.status)) return null;
    const { products, ...rest } = d;
    await tx.sellerProduct.deleteMany({ where: { sellerId: id } });
    const s = await tx.seller.update({
      where: { id },
      data: { ...rest, products: { create: products.map((p, i) => ({ sectorId: p.sectorId, products: p.products, sortOrder: i })) } },
    });
    await tx.sellerLog.create({ data: { sellerId: id, actorId: user.id, actorRole: "DISTRICT", action: "UPDATED" } });
    if (recommend) await recommendOne(tx, s.id, s.status, user.id);
    return s;
  });
  if (!seller) return { error: "This seller can no longer be edited (already with the Directorate or decided)." };
  revalidateAll();
  redirect(`/district/sellers/${seller.id}?done=${recommend ? "recommended" : id ? "updated" : "registered"}`);
}

async function recommendOne(tx: Prisma.TransactionClient, id: string, status: SellerStatus, actorId: string, comment?: string | null) {
  if (!SELLER_DISTRICT_EDITABLE.includes(status)) return false;
  await tx.seller.update({ where: { id }, data: { status: "RECOMMENDED", recommendedAt: new Date() } });
  await tx.sellerLog.create({ data: { sellerId: id, actorId, actorRole: "DISTRICT", action: "RECOMMENDED", comment: comment ?? null } });
  return true;
}

// ---------------------------------------------------------------- public self-registration

export async function selfRegisterSellerAction(_: FormState, form: FormData): Promise<FormState> {
  const raw = readForm(form);
  const parsed = sellerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error, true), error: "Please correct the highlighted fields." };
  const d = parsed.data;
  const sectorErr = await checkSectors(d);
  if (sectorErr) return { error: sectorErr };
  if (await prisma.seller.findUnique({ where: { udyamNo: d.udyamNo } })) {
    return { fieldErrors: { udyamNo: "This Udyam number is already registered. Please contact your District Industries Centre." }, error: "Please correct the highlighted fields." };
  }
  const seller = await prisma.$transaction((tx) => createSeller(tx, d, "SELF", null));
  const m = sellerMail.received(seller.name, seller.regNo, seller.district);
  await sendMail(seller.contactEmail, m.subject, m.text);
  revalidateAll();
  return { ok: true, data: { regNo: seller.regNo, district: seller.district, email: seller.contactEmail } };
}

// ---------------------------------------------------------------- decisions (district / Directorate)

type Decision = "recommend" | "reject" | "approve" | "return";

const commentField = englishText({ max: 2000, label: "Comment", multiline: true });

/**
 * One or many sellers at once (form fields: sellerIds…, decision, comment).
 * District: recommend / reject. Directorate: approve / return / reject.
 */
export async function sellerDecisionAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["DISTRICT", "DIC"]);
  const decision = String(form.get("decision")) as Decision;
  const allowed: Decision[] = user.role === "DISTRICT" ? ["recommend", "reject"] : ["approve", "return", "reject"];
  if (!allowed.includes(decision)) return { error: "Unknown action." };
  const ids = [...new Set(form.getAll("sellerIds").map(String).filter(Boolean))];
  if (!ids.length) return { error: "Select at least one seller." };
  const pc = commentField.safeParse(String(form.get("comment") ?? ""));
  if (!pc.success) return { fieldErrors: { comment: pc.error.issues[0].message } };
  const comment = pc.data || null;
  if ((decision === "return" || decision === "reject") && (!comment || comment.length < 5)) {
    return { fieldErrors: { comment: "A comment (at least 5 characters) is required when returning or rejecting." }, error: "Please add a comment." };
  }

  const from: SellerStatus[] = user.role === "DISTRICT" ? SELLER_DISTRICT_EDITABLE : ["RECOMMENDED"];
  const sellers = await prisma.seller.findMany({
    where: { id: { in: ids }, status: { in: from }, ...(user.role === "DISTRICT" ? { district: user.district! } : {}) },
  });
  if (!sellers.length) return { error: "These sellers have already been acted on. Refresh the page." };

  const now = new Date();
  const passwordHash = decision === "approve" ? await hashPassword(EVENT.defaultBuyerPassword) : "";
  const done: { name: string; email: string; regNo: string; approvedNo?: string; username?: string }[] = [];
  for (const s of sellers) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.seller.findUnique({ where: { id: s.id } });
      if (!fresh || !from.includes(fresh.status)) return;
      if (decision === "recommend") {
        await recommendOne(tx, s.id, fresh.status, user.id, comment);
      } else if (decision === "approve") {
        const seq = await nextSeq(tx, `seller-approved-${EVENT.approvedYear}`);
        const username = sellerUsername(fresh.seq);
        const login = await tx.user.upsert({
          where: { username },
          create: { username, passwordHash, role: "SELLER", displayName: fresh.name, mustChangePassword: true },
          update: { passwordHash, role: "SELLER", displayName: fresh.name, mustChangePassword: true, isActive: true },
        });
        const approvedNo = approvedSellerNo(seq);
        await tx.seller.update({ where: { id: s.id }, data: { status: "APPROVED", approvedAt: now, approvedSeq: seq, approvedNo, userId: login.id } });
        await tx.sellerLog.create({ data: { sellerId: s.id, actorId: user.id, actorRole: "DIC", action: "APPROVED", comment } });
        done.push({ name: fresh.name, email: fresh.contactEmail, regNo: fresh.regNo, approvedNo, username });
        return;
      } else {
        const status: SellerStatus = decision === "return" ? "RETURNED" : "REJECTED";
        await tx.seller.update({ where: { id: s.id }, data: { status } });
        await tx.sellerLog.create({
          data: { sellerId: s.id, actorId: user.id, actorRole: user.role, action: decision === "return" ? "RETURNED" : "REJECTED", comment },
        });
      }
      done.push({ name: fresh.name, email: fresh.contactEmail, regNo: fresh.regNo });
    });
  }

  for (const d of done) {
    if (decision === "approve") {
      const m = sellerMail.approved(d.name, d.approvedNo!, d.username!, EVENT.defaultBuyerPassword);
      await sendMail(d.email, m.subject, m.text);
    } else if (decision === "reject") {
      const m = sellerMail.rejected(d.name, d.regNo, comment!);
      await sendMail(d.email, m.subject, m.text);
    }
  }
  revalidateAll();
  const verb: Record<Decision, string> = {
    recommend: "recommended to the Directorate", approve: "approved — logins allotted and e-mailed",
    return: "returned to the district", reject: "rejected",
  };
  return { ok: true, message: `${done.length} seller${done.length === 1 ? "" : "s"} ${verb[decision]}${done.length === 1 ? ` (${done[0].name})` : ""}.` };
}
