"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { mailTemplates, sendMail } from "@/lib/mail";
import { nextSeq } from "@/lib/sequence";
import { approvedBuyerNo, EVENT } from "@/lib/config";
import { DIC_ITEM_QUEUE, FIEO_ITEM_QUEUE } from "@/lib/status";
import type { ItemStatus, ReviewAction } from "@/generated/prisma/enums";
import type { FormState } from "./auth";
import { englishText } from "@/lib/text";
import { itemSnapshot, profileSnapshot } from "@/lib/item-snapshot";

const commentField = englishText({ max: 2000, label: "Comment", multiline: true });

const revalidateAll = () => {
  revalidatePath("/fieo", "layout");
  revalidatePath("/dic", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/buyer", "layout");
};

// ---------------------------------------------------------------- basic details (FIEO)

export async function basicReviewAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("FIEO");
  const decision = String(form.get("decision"));
  if (decision !== "approve_basic" && decision !== "return_basic") return { error: "Unknown action." };
  const parsed = commentField.safeParse(String(form.get("comment") ?? ""));
  if (!parsed.success) return { fieldErrors: { comment: parsed.error.issues[0].message } };
  const comment = parsed.data || null;
  if (decision === "return_basic" && (!comment || comment.length < 5)) {
    return { fieldErrors: { comment: "A comment (at least 5 characters) is required when returning." } };
  }
  const buyerId = String(form.get("buyerId") ?? "");
  const approve = decision === "approve_basic";
  const buyer = await prisma.$transaction(async (tx) => {
    const moved = await tx.buyer.updateMany({
      where: { id: buyerId, status: "BASIC_SUBMITTED" },
      data: approve ? { status: "BASIC_APPROVED", basicApprovedAt: new Date() } : { status: "BASIC_RETURNED" },
    });
    if (moved.count !== 1) return null;
    await tx.reviewLog.create({ data: { buyerId, actorId: user.id, actorRole: "FIEO", action: approve ? "BASIC_APPROVED" : "BASIC_RETURNED", comment } });
    return tx.buyer.findUnique({ where: { id: buyerId } });
  });
  if (!buyer) return { error: "This application has already been acted on. Refresh the page." };
  const mail = approve ? mailTemplates.basicApproved(buyer.name) : mailTemplates.returned(buyer.name, "basic registration details", comment!);
  await sendMail(buyer.pocEmail ?? buyer.signupEmail, mail.subject, mail.text);
  revalidateAll();
  return { ok: true, message: approve ? "Basic details approved. The buyer can now add sector requirements." : "Returned to the buyer with your comment." };
}

// ---------------------------------------------------------------- sector requirements (FIEO / DIC)

type Decision = "recommend" | "return" | "approve";

const RULES = {
  FIEO: {
    from: FIEO_ITEM_QUEUE,
    recommend: { to: "FIEO_RECOMMENDED" as ItemStatus, log: "FIEO_RECOMMENDED" as ReviewAction },
    return: { to: "FIEO_RETURNED" as ItemStatus, log: "REQ_RETURNED" as ReviewAction },
  },
  DIC: {
    from: DIC_ITEM_QUEUE,
    approve: { to: "APPROVED" as ItemStatus, log: "DIC_APPROVED" as ReviewAction },
    return: { to: "DIC_RETURNED" as ItemStatus, log: "DIC_RETURNED" as ReviewAction },
  },
};

/**
 * One submission can carry a different decision for every sector, e.g. FIEO
 * recommends "Tea & Coffee" and returns "Spices" in the same step.
 * Form fields: buyerId, itemIds (repeated), decision_<id>, comment_<id>.
 */
export async function itemReviewAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["FIEO", "DIC"]);
  const role = user.role as "FIEO" | "DIC";
  const rules = RULES[role];
  const buyerId = String(form.get("buyerId") ?? "");
  const ids = form.getAll("itemIds").map(String);

  const decisions: { id: string; decision: Decision; comment: string | null }[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const id of ids) {
    const decision = String(form.get(`decision_${id}`) ?? "") as Decision | "";
    if (!decision) continue;
    if (!(decision in rules)) return { error: "Unknown decision." };
    const parsed = commentField.safeParse(String(form.get(`comment_${id}`) ?? ""));
    if (!parsed.success) { fieldErrors[`comment_${id}`] = parsed.error.issues[0].message; continue; }
    const comment = parsed.data || null;
    if (decision === "return" && (!comment || comment.length < 5)) {
      fieldErrors[`comment_${id}`] = "A comment (at least 5 characters) is required when returning.";
      continue;
    }
    decisions.push({ id, decision, comment });
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Please add the missing comments." };
  if (!decisions.length) return { error: "Choose a decision for at least one sector." };

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) return null;
    const items = await tx.requirementItem.findMany({
      where: { id: { in: decisions.map((d) => d.id) }, requirement: { buyerId } },
      include: { sector: true },
    });
    const done: { sector: string; decision: Decision; comment: string | null }[] = [];
    for (const d of decisions) {
      const item = items.find((i) => i.id === d.id);
      if (!item || !rules.from.includes(item.status)) continue; // already acted on by someone else
      const rule = (rules as unknown as Record<Decision, { to: ItemStatus; log: ReviewAction }>)[d.decision];
      const snap = itemSnapshot(item, item.sector.name);
      const moved = await tx.requirementItem.updateMany({
        where: { id: item.id, status: item.status },
        data: {
          status: rule.to,
          ...(rule.to === "FIEO_RECOMMENDED" ? { recommendedAt: now } : {}),
          // Keep what was approved / returned so later changes can be highlighted for reviewers.
          ...(rule.to === "APPROVED" ? { approvedAt: now, everApproved: true, approvedSnapshot: snap, returnedSnapshot: null } : {}),
          ...(rule.to === "FIEO_RETURNED" ? { returnedSnapshot: snap } : {}),
        },
      });
      if (moved.count !== 1) continue;
      await tx.reviewLog.create({
        data: { buyerId, actorId: user.id, actorRole: role, action: rule.log, comment: d.comment, itemId: item.id, sectorName: item.sector.name },
      });
      done.push({ sector: item.sector.name, decision: d.decision, comment: d.comment });
    }

    if (done.some((d) => d.decision === "approve")) {
      const req = await tx.requirement.findUnique({ where: { buyerId } });
      if (req) await tx.requirement.update({ where: { id: req.id }, data: { approvedProfile: profileSnapshot(req) } });
    }

    // First approved sector makes the buyer an approved RBSM buyer.
    let newlyApproved = false;
    if (done.some((d) => d.decision === "approve") && buyer.status !== "APPROVED") {
      const seq = buyer.approvedSeq ?? (await nextSeq(tx, `approved-${EVENT.approvedYear}`));
      const updated = await tx.buyer.update({
        where: { id: buyerId },
        data: { status: "APPROVED", approvedSeq: seq, approvedNo: buyer.approvedNo ?? approvedBuyerNo(seq), approvedAt: buyer.approvedAt ?? now },
      });
      buyer.approvedNo = updated.approvedNo;
      newlyApproved = true;
    }
    return { buyer, done, newlyApproved };
  });

  if (!result) return { error: "Buyer not found." };
  const { buyer, done, newlyApproved } = result;
  if (!done.length) return { error: "These sectors have already been acted on. Refresh the page." };

  // E-mail the buyer about returns (FIEO) and approvals (DIC); hand-offs between reviewers are internal.
  const to = buyer.pocEmail ?? buyer.signupEmail;
  const returned = done.filter((d) => d.decision === "return");
  const approved = done.filter((d) => d.decision === "approve");
  if (role === "FIEO" && returned.length) {
    const m = mailTemplates.sectorsReturned(buyer.name, returned.map((r) => ({ sector: r.sector, comment: r.comment! })));
    await sendMail(to, m.subject, m.text);
  }
  if (approved.length) {
    const m = mailTemplates.sectorsApproved(buyer.name, buyer.approvedNo!, approved.map((a) => a.sector), newlyApproved);
    await sendMail(to, m.subject, m.text);
  }

  revalidateAll();
  const verb: Record<Decision, string> = {
    recommend: "recommended to the Directorate",
    approve: "approved",
    return: role === "FIEO" ? "returned to the buyer" : "returned to FIEO",
  };
  const summary = (["recommend", "approve", "return"] as Decision[])
    .map((k) => {
      const names = done.filter((d) => d.decision === k).map((d) => d.sector);
      return names.length ? `${names.join(", ")} ${verb[k]}` : null;
    })
    .filter(Boolean)
    .join("; ");
  return {
    ok: true,
    message: `${summary}.${newlyApproved ? ` ${buyer.name} is now an approved RBSM buyer (${buyer.approvedNo}).` : ""}`,
  };
}
