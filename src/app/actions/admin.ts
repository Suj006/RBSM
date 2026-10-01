"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { EVENT } from "@/lib/config";
import { mailTemplates, sendMail } from "@/lib/mail";
import type { FormState } from "./auth";
import { englishText, firstErrors } from "@/lib/text";

const masterSchema = z.object({
  name: englishText({ min: 2, max: 120, label: "Name" }),
  description: englishText({ max: 500, label: "Description" }).transform((v) => v || null),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

type Kind = "sector" | "certification";

export async function saveMasterAction(_: FormState, form: FormData): Promise<FormState> {
  await requireUser("ADMIN");
  const kind = String(form.get("kind")) as Kind;
  const id = String(form.get("id") ?? "") || null;
  const parsed = masterSchema.safeParse({
    name: form.get("name") ?? "", description: form.get("description") ?? "", sortOrder: form.get("sortOrder") || 0,
  });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) };
  const { name, description, sortOrder } = parsed.data;

  try {
    if (kind === "sector") {
      if (id) await prisma.sector.update({ where: { id }, data: { name, description, sortOrder } });
      else await prisma.sector.create({ data: { name, description, sortOrder } });
    } else if (kind === "certification") {
      if (id) await prisma.certification.update({ where: { id }, data: { name, description } });
      else await prisma.certification.create({ data: { name, description } });
    } else return { error: "Unknown master." };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { fieldErrors: { name: "An entry with this name already exists." } };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: id ? "Updated." : "Added." };
}

export async function toggleMasterAction(form: FormData) {
  await requireUser("ADMIN");
  const kind = String(form.get("kind")) as Kind;
  const id = String(form.get("id"));
  const isActive = form.get("isActive") === "true";
  if (kind === "sector") await prisma.sector.update({ where: { id }, data: { isActive } });
  if (kind === "certification") await prisma.certification.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin", "layout");
}

/** Resets a buyer's password to the phase-1 default and forces a change on next login. */
export async function resetBuyerPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  await requireUser("ADMIN");
  const buyer = await prisma.buyer.findUnique({ where: { id: String(form.get("buyerId")) }, include: { user: true } });
  if (!buyer) return { error: "Buyer not found." };
  await prisma.user.update({
    where: { id: buyer.userId },
    data: { passwordHash: await hashPassword(EVENT.defaultBuyerPassword), mustChangePassword: true },
  });
  await prisma.session.deleteMany({ where: { userId: buyer.userId } });
  const mail = mailTemplates.credentials(buyer.name, buyer.user.username, EVENT.defaultBuyerPassword);
  await sendMail(buyer.pocEmail ?? buyer.signupEmail, mail.subject, mail.text);
  return { ok: true, message: `Password reset to the default and e-mailed to the buyer. They must change it on next login.` };
}

export async function setUserActiveAction(form: FormData) {
  await requireUser("ADMIN");
  const userId = String(form.get("userId"));
  const isActive = form.get("isActive") === "true";
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  if (!isActive) await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/admin", "layout");
}

const staffPw = z.string().min(6, "Use at least 6 characters.").max(72);

export async function setStaffPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("ADMIN");
  const userId = String(form.get("userId"));
  const parsed = staffPw.safeParse(String(form.get("password") ?? ""));
  if (!parsed.success) return { fieldErrors: { password: parsed.error.issues[0].message } };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "BUYER") return { error: "Staff user not found." };
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data) } });
  if (user.id !== admin.id) await prisma.session.deleteMany({ where: { userId } });
  return { ok: true, message: `Password updated for ${user.username}.` };
}
