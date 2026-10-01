"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";
import { canEditBasic, canWorkOnRequirements, ITEM_EDITABLE } from "@/lib/status";
import { parseCerts } from "@/lib/format";
import { deleteUpload, storeUpload, validateUpload } from "@/lib/storage";
import type { DocumentKind } from "@/generated/prisma/enums";
import type { FormState } from "./auth";
import { designation, emailField, firstErrors, englishText, mobileField, orgName, personName } from "@/lib/text";

const fieldErrors = (e: z.ZodError) => firstErrors(e, true);

/** Empty input → null (draft), otherwise validated by `field` with its own messages. */
const optional = <T extends z.ZodType<string, string>>(field: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), field.nullable());
const opt = (max: number, label: string) =>
  englishText({ max, label }).transform((v) => v || null);

// ---------------------------------------------------------------- basic details

// Every text field is English-only; names are stored in Title Case.
const basicDraft = z.object({
  name: orgName(),
  country: z.string().refine((c) => COUNTRIES.includes(c), "Select a country from the list."),
  pocName: optional(personName("Contact name")),
  pocDesignation: optional(designation()),
  pocEmail: optional(emailField()),
  pocMobile: optional(mobileField()),
});

const basicSubmit = basicDraft.extend({
  pocName: personName("Contact name"),
  pocDesignation: designation(),
  pocEmail: emailField(),
  pocMobile: mobileField(),
});

const FILE_FIELDS: [string, DocumentKind][] = [["profileFile", "PROFILE"], ["credentialsFile", "CREDENTIALS"]];

export async function saveBasicAction(_: FormState, form: FormData): Promise<FormState> {
  const { user, buyer } = await requireBuyer();
  if (!canEditBasic(buyer.status)) return { error: "Your basic details are locked while under review or after approval." };

  const intent = form.get("intent") === "submit" ? "submit" : "save";
  const raw = Object.fromEntries(
    ["name", "country", "pocName", "pocDesignation", "pocEmail", "pocMobile"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const parsed = (intent === "submit" ? basicSubmit : basicDraft).safeParse(raw);
  const errors: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);

  // Validate files first, store only when the whole form is valid.
  const files: { kind: DocumentKind; file: File }[] = [];
  for (const [field, kind] of FILE_FIELDS) {
    const f = form.get(field);
    if (f instanceof File && f.size > 0) {
      const err = validateUpload(f);
      if (err) errors[field] = err;
      else files.push({ kind, file: f });
    }
  }
  if (intent === "submit") {
    const existing = await prisma.document.findMany({ where: { buyerId: buyer.id }, select: { kind: true } });
    for (const [field, kind] of FILE_FIELDS) {
      if (!existing.some((d) => d.kind === kind) && !files.some((f) => f.kind === kind)) {
        errors[field] = kind === "PROFILE" ? "Upload your company profile." : "Upload your organisation credentials.";
      }
    }
  }
  if (!parsed.success || Object.keys(errors).length) {
    return { fieldErrors: errors, error: "Please correct the highlighted fields.", data: raw };
  }

  for (const { kind, file } of files) {
    let storedName: string;
    try {
      storedName = await storeUpload(file, buyer.id, kind.toLowerCase());
    } catch (e) {
      return { fieldErrors: { [kind === "PROFILE" ? "profileFile" : "credentialsFile"]: (e as Error).message }, data: raw };
    }
    const prev = await prisma.document.findUnique({ where: { buyerId_kind: { buyerId: buyer.id, kind } } });
    const doc = { originalName: file.name.slice(0, 200), storedName, mimeType: file.type, size: file.size, uploadedAt: new Date() };
    await prisma.document.upsert({
      where: { buyerId_kind: { buyerId: buyer.id, kind } },
      create: { buyerId: buyer.id, kind, ...doc },
      update: doc,
    });
    if (prev) await deleteUpload(prev.storedName);
  }

  const d = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.buyer.update({
      where: { id: buyer.id },
      data: {
        ...d,
        ...(intent === "submit" ? { status: "BASIC_SUBMITTED", basicSubmittedAt: new Date() } : {}),
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { displayName: d.name } });
    if (intent === "submit") {
      await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action: "BASIC_SUBMITTED" } });
    }
  });

  revalidatePath("/buyer", "layout");
  return {
    ok: true,
    message: intent === "submit"
      ? "Basic details submitted to FIEO for approval. You will be notified by e-mail."
      : "Draft saved.",
  };
}

// ---------------------------------------------------------------- sourcing profile

const profileSchema = z.object({
  organisationType: opt(80, "Organisation type"),
  procurementInterests: englishText({ max: 3000, label: "Procurement interests", multiline: true }).transform((v) => v || null),
  annualSourcingValue: opt(80, "Annual sourcing value"),
  sourcingTimeline: opt(80, "Sourcing timeline"),
  preferredEngagement: opt(120, "Preferred engagement"),
});

/** What is still missing from the sourcing profile before a sector can be submitted. */
function profileGaps(req: { organisationType: string | null; procurementInterests: string | null; annualSourcingValue: string | null; sourcingTimeline: string | null } | null) {
  const gaps: string[] = [];
  if (!req?.organisationType) gaps.push("organisation type");
  if (!req?.procurementInterests || req.procurementInterests.length < 20) gaps.push("procurement interests (at least 20 characters)");
  if (!req?.annualSourcingValue) gaps.push("annual sourcing value");
  if (!req?.sourcingTimeline) gaps.push("sourcing timeline");
  return gaps;
}

async function requireRequirementBuyer() {
  const ctx = await requireBuyer();
  if (!canWorkOnRequirements(ctx.buyer.status)) return null;
  return ctx;
}

export async function saveProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRequirementBuyer();
  if (!ctx) return { error: "Sector requirements open after FIEO approves your basic details." };
  const parsed = profileSchema.safeParse(Object.fromEntries(
    ["organisationType", "procurementInterests", "annualSourcingValue", "sourcingTimeline", "preferredEngagement"].map((k) => [k, String(form.get(k) ?? "")]),
  ));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "Please correct the highlighted fields." };
  await prisma.requirement.upsert({
    where: { buyerId: ctx.buyer.id },
    create: { buyerId: ctx.buyer.id, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/buyer", "layout");
  const gaps = profileGaps(parsed.data);
  return { ok: true, message: gaps.length ? `Saved. Still needed before submitting sectors: ${gaps.join(", ")}.` : "Sourcing profile saved." };
}

// ---------------------------------------------------------------- sector requirements

const itemSchema = z.object({
  sectorId: z.string().min(1, "Select a sector."),
  products: englishText({ min: 2, max: 1000, label: "Products", multiline: true }),
  specifications: englishText({ max: 2000, label: "Specifications", multiline: true }),
  certifications: z.array(englishText({ min: 1, max: 120, label: "Certification" })).max(40),
  quantity: englishText({ max: 200, label: "Quantity" }),
});

const sameContent = (
  a: { sectorId: string; products: string; specifications: string | null; certifications: string; quantity: string | null },
  b: z.infer<typeof itemSchema>,
) =>
  a.sectorId === b.sectorId && a.products === b.products && (a.specifications ?? "") === b.specifications &&
  (a.quantity ?? "") === b.quantity && JSON.stringify([...parseCerts(a.certifications)].sort()) === JSON.stringify([...new Set(b.certifications)].sort());

export async function saveItemAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRequirementBuyer();
  if (!ctx) return { error: "Sector requirements open after FIEO approves your basic details." };
  const { user, buyer } = ctx;
  const intent = form.get("intent") === "submit" ? "submit" : "save";
  const itemId = String(form.get("itemId") ?? "") || null;

  let certifications: unknown = [];
  try { certifications = JSON.parse(String(form.get("certifications") ?? "[]")); } catch { /* validated below */ }
  const parsed = itemSchema.safeParse({
    sectorId: String(form.get("sectorId") ?? ""),
    products: String(form.get("products") ?? ""),
    specifications: String(form.get("specifications") ?? ""),
    quantity: String(form.get("quantity") ?? ""),
    certifications,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "Please correct the highlighted fields." };
  const d = parsed.data;

  const req = await prisma.requirement.upsert({ where: { buyerId: buyer.id }, create: { buyerId: buyer.id }, update: {}, include: { items: true } });
  const existing = itemId ? req.items.find((i) => i.id === itemId) : null;
  if (itemId && !existing) return { error: "This requirement no longer exists. Refresh the page." };
  if (existing && !ITEM_EDITABLE.includes(existing.status)) return { error: "This sector is with a reviewer and cannot be changed now." };
  if (req.items.some((i) => i.sectorId === d.sectorId && i.id !== itemId)) {
    return { fieldErrors: { sectorId: "You already have a requirement for this sector — edit that one instead." } };
  }
  const sector = await prisma.sector.findUnique({ where: { id: d.sectorId } });
  if (!sector || (!sector.isActive && existing?.sectorId !== d.sectorId)) return { fieldErrors: { sectorId: "Select a sector from the list." } };
  if (intent === "submit") {
    const gaps = profileGaps(req);
    if (gaps.length) return { error: `Complete your sourcing profile first (missing: ${gaps.join(", ")}).` };
  }

  const unchanged = existing && sameContent(existing, d);
  if (existing?.status === "APPROVED" && unchanged) {
    return { error: "No changes made — this sector is already approved." };
  }

  const content = {
    sectorId: d.sectorId,
    products: d.products,
    specifications: d.specifications || null,
    certifications: JSON.stringify([...new Set(d.certifications)]),
    quantity: d.quantity || null,
  };
  const now = new Date();
  const submit = intent === "submit";

  await prisma.$transaction(async (tx) => {
    const reopened = existing?.status === "APPROVED";
    const status = submit ? "SUBMITTED" : existing?.status === "FIEO_RETURNED" ? "FIEO_RETURNED" : "DRAFT";
    const item = existing
      ? await tx.requirementItem.update({
          where: { id: existing.id },
          data: { ...content, status, ...(submit ? { submittedAt: now } : {}), ...(reopened ? { everApproved: true, approvedAt: null } : {}) },
        })
      : await tx.requirementItem.create({
          data: { requirementId: req.id, ...content, status, sortOrder: req.items.length, ...(submit ? { submittedAt: now } : {}) },
        });
    const log = (action: "REQ_MODIFIED" | "REQ_SUBMITTED") =>
      tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action, itemId: item.id, sectorName: sector.name } });
    if (reopened) await log("REQ_MODIFIED");
    if (submit) await log("REQ_SUBMITTED");
  });

  revalidatePath("/buyer", "layout");
  return {
    ok: true,
    message: submit
      ? `${sector.name}: submitted to FIEO for recommendation.`
      : existing?.status === "APPROVED"
        ? `${sector.name}: changes saved as a draft. Submit it to send the changes for approval.`
        : `${sector.name}: draft saved.`,
  };
}

/** Submits every draft / returned sector in one go. */
export async function submitAllAction(): Promise<FormState> {
  const ctx = await requireRequirementBuyer();
  if (!ctx) return { error: "Sector requirements open after FIEO approves your basic details." };
  const { user, buyer } = ctx;
  const req = await prisma.requirement.findUnique({
    where: { buyerId: buyer.id },
    include: { items: { where: { status: { in: ["DRAFT", "FIEO_RETURNED"] } }, include: { sector: true } } },
  });
  if (!req?.items.length) return { error: "There are no draft or returned sectors to submit." };
  const gaps = profileGaps(req);
  if (gaps.length) return { error: `Complete your sourcing profile first (missing: ${gaps.join(", ")}).` };
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const it of req.items) {
      await tx.requirementItem.update({ where: { id: it.id }, data: { status: "SUBMITTED", submittedAt: now } });
      await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action: "REQ_SUBMITTED", itemId: it.id, sectorName: it.sector.name } });
    }
  });
  revalidatePath("/buyer", "layout");
  return { ok: true, message: `${req.items.length} sector${req.items.length > 1 ? "s" : ""} submitted to FIEO: ${req.items.map((i) => i.sector.name).join(", ")}.` };
}

export async function removeItemAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRequirementBuyer();
  if (!ctx) return { error: "Not allowed." };
  const { user, buyer } = ctx;
  const item = await prisma.requirementItem.findFirst({
    where: { id: String(form.get("itemId") ?? ""), requirement: { buyerId: buyer.id } },
    include: { sector: true },
  });
  if (!item) return { error: "This requirement no longer exists." };
  if (!ITEM_EDITABLE.includes(item.status)) return { error: "This sector is with a reviewer and cannot be removed now." };
  await prisma.$transaction(async (tx) => {
    // Only record removals of sectors a reviewer has seen; plain drafts vanish quietly.
    if (item.status !== "DRAFT" || item.everApproved || item.submittedAt) {
      await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action: "REQ_WITHDRAWN", sectorName: item.sector.name } });
    }
    await tx.requirementItem.delete({ where: { id: item.id } });
  });
  revalidatePath("/buyer", "layout");
  return { ok: true, message: `${item.sector.name} removed.` };
}
