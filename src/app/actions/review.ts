"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { mailTemplates, sendMail } from "@/lib/mail";
import { nextSeq } from "@/lib/sequence";
import { approvedBuyerNo, EVENT } from "@/lib/config";
import type { BuyerStatus, ReviewAction, Role } from "@/generated/prisma/enums";
import type { FormState } from "./auth";

type Decision =
  | "approve_basic" | "return_basic"       // FIEO, on basic details
  | "recommend" | "return_requirement"     // FIEO, on the detailed requirement (or after DIC return)
  | "dic_approve" | "dic_return";          // Directorate

const RULES: Record<Decision, { role: Role; from: BuyerStatus[]; to: BuyerStatus; log: ReviewAction; needsComment: boolean }> = {
  approve_basic: { role: "FIEO", from: ["BASIC_SUBMITTED"], to: "BASIC_APPROVED", log: "BASIC_APPROVED", needsComment: false },
  return_basic: { role: "FIEO", from: ["BASIC_SUBMITTED"], to: "BASIC_RETURNED", log: "BASIC_RETURNED", needsComment: true },
  recommend: { role: "FIEO", from: ["REQ_SUBMITTED", "DIC_RETURNED"], to: "FIEO_RECOMMENDED", log: "FIEO_RECOMMENDED", needsComment: false },
  return_requirement: { role: "FIEO", from: ["REQ_SUBMITTED", "DIC_RETURNED"], to: "REQ_RETURNED", log: "REQ_RETURNED", needsComment: true },
  dic_approve: { role: "DIC", from: ["FIEO_RECOMMENDED"], to: "APPROVED", log: "DIC_APPROVED", needsComment: false },
  dic_return: { role: "DIC", from: ["FIEO_RECOMMENDED"], to: "DIC_RETURNED", log: "DIC_RETURNED", needsComment: true },
};

export async function reviewAction(_: FormState, form: FormData): Promise<FormState> {
  const decision = String(form.get("decision")) as Decision;
  const rule = RULES[decision];
  if (!rule) return { error: "Unknown action." };
  const user = await requireUser(rule.role);
  const buyerId = String(form.get("buyerId") ?? "");
  const comment = String(form.get("comment") ?? "").trim().slice(0, 2000) || null;
  if (rule.needsComment && (!comment || comment.length < 5)) {
    return { fieldErrors: { comment: "A comment (at least 5 characters) is required when returning." } };
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer || !rule.from.includes(buyer.status)) return null;

    const data: Parameters<typeof tx.buyer.update>[0]["data"] = { status: rule.to };
    if (decision === "approve_basic") data.basicApprovedAt = now;
    if (decision === "recommend") data.recommendedAt = now;
    if (decision === "dic_approve") {
      const seq = await nextSeq(tx, `approved-${EVENT.approvedYear}`);
      data.approvedSeq = seq;
      data.approvedNo = approvedBuyerNo(seq);
      data.approvedAt = now;
    }
    // Guard against two reviewers acting at once: only move from the status we read.
    const moved = await tx.buyer.updateMany({ where: { id: buyer.id, status: buyer.status }, data });
    if (moved.count !== 1) return null;
    await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: user.role, action: rule.log, comment } });
    return { ...buyer, approvedNo: (data.approvedNo as string | undefined) ?? buyer.approvedNo };
  });

  if (!result) return { error: "This application has already been acted on or is not at this stage. Refresh the page." };

  const to = result.pocEmail ?? result.signupEmail;
  const mail =
    decision === "approve_basic" ? mailTemplates.basicApproved(result.name)
    : decision === "return_basic" ? mailTemplates.returned(result.name, "basic registration details", comment!)
    : decision === "return_requirement" ? mailTemplates.returned(result.name, "detailed requirement", comment!)
    : decision === "dic_approve" ? mailTemplates.approved(result.name, result.approvedNo!)
    : null; // recommend / dic_return are internal hand-offs
  if (mail) {
    await sendMail(to, mail.subject, mail.text);
    if (to !== result.signupEmail && decision === "dic_approve") await sendMail(result.signupEmail, mail.subject, mail.text);
  }

  revalidatePath("/fieo", "layout");
  revalidatePath("/dic", "layout");
  revalidatePath("/admin", "layout");
  const msg: Record<Decision, string> = {
    approve_basic: "Basic details approved. The buyer can now submit the detailed requirement.",
    return_basic: "Returned to the buyer with your comment.",
    recommend: "Recommended to the Directorate.",
    return_requirement: "Returned to the buyer with your comment.",
    dic_approve: `Approved — added to the RBSM buyer list as ${result.approvedNo}.`,
    dic_return: "Returned to FIEO for re-verification.",
  };
  return { ok: true, message: msg[decision] };
}
