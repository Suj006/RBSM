"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";
import { canEditBasic, canEditRequirement } from "@/lib/status";
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

// ---------------------------------------------------------------- detailed requirement

const itemSchema = z.object({
  sectorId: z.string().min(1, "Select a sector."),
  products: englishText({ min: 2, max: 1000, label: "Products", multiline: true }),
  specifications: englishText({ max: 2000, label: "Specifications", multiline: true }).optional().default(""),
  certifications: z.array(englishText({ min: 1, max: 120, label: "Certification" })).max(40).default([]),
  quantity: englishText({ max: 200, label: "Quantity" }).optional().default(""),
});

const reqDraft = z.object({
  organisationType: opt(80, "Organisation type"),
  procurementInterests: englishText({ max: 3000, label: "Procurement interests", multiline: true }).transform((v) => v || null),
  annualSourcingValue: opt(80, "Annual sourcing value"),
  sourcingTimeline: opt(80, "Sourcing timeline"),
  preferredEngagement: opt(120, "Preferred engagement"),
  items: z.array(itemSchema.partial({ products: true, sectorId: true })).max(25),
});

const reqSubmit = reqDraft.extend({
  organisationType: z.string().trim().min(1, "Select the organisation type."),
  procurementInterests: englishText({ min: 20, max: 3000, label: "Procurement interests", multiline: true }),
  annualSourcingValue: z.string().trim().min(1, "Select the indicative annual sourcing value."),
  sourcingTimeline: z.string().trim().min(1, "Select the sourcing timeline."),
  items: z.array(itemSchema).min(1, "Add at least one sector with products.").max(25),
});

export async function saveRequirementAction(_: FormState, form: FormData): Promise<FormState> {
  const { user, buyer } = await requireBuyer();
  if (!canEditRequirement(buyer.status)) {
    return { error: "The detailed requirement can be edited only after FIEO approves your basic details, or when it is returned for correction." };
  }
  const intent = form.get("intent") === "submit" ? "submit" : "save";
  let items: unknown = [];
  try {
    items = JSON.parse(String(form.get("items") ?? "[]"));
  } catch {
    return { error: "Could not read the sector list. Please try again." };
  }
  const raw = {
    organisationType: String(form.get("organisationType") ?? ""),
    procurementInterests: String(form.get("procurementInterests") ?? ""),
    annualSourcingValue: String(form.get("annualSourcingValue") ?? ""),
    sourcingTimeline: String(form.get("sourcingTimeline") ?? ""),
    preferredEngagement: String(form.get("preferredEngagement") ?? ""),
    items,
  };
  const parsed = (intent === "submit" ? reqSubmit : reqDraft).safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "Please correct the highlighted fields." };

  const d = parsed.data;
  // Drop fully blank rows when saving a draft; make sure sector ids are real.
  const rows = d.items.filter((i) => i.sectorId || i.products);
  const sectorIds = [...new Set(rows.map((r) => r.sectorId).filter(Boolean) as string[])];
  const validSectors = await prisma.sector.count({ where: { id: { in: sectorIds } } });
  if (validSectors !== sectorIds.length) return { error: "One of the selected sectors is no longer available. Please re-select." };
  if (rows.some((r) => !r.sectorId)) return { fieldErrors: { items: "Select a sector for every row (or remove the row)." }, error: "Please correct the highlighted fields." };

  await prisma.$transaction(async (tx) => {
    const header = {
      organisationType: d.organisationType, procurementInterests: d.procurementInterests,
      annualSourcingValue: d.annualSourcingValue, sourcingTimeline: d.sourcingTimeline, preferredEngagement: d.preferredEngagement,
    };
    const req = await tx.requirement.upsert({
      where: { buyerId: buyer.id },
      create: { buyerId: buyer.id, ...header },
      update: header,
    });
    await tx.requirementItem.deleteMany({ where: { requirementId: req.id } });
    await tx.requirementItem.createMany({
      data: rows.map((r, i) => ({
        requirementId: req.id,
        sectorId: r.sectorId!,
        products: r.products ?? "",
        specifications: r.specifications || null,
        certifications: JSON.stringify([...new Set(r.certifications ?? [])]),
        quantity: r.quantity || null,
        sortOrder: i,
      })),
    });
    if (intent === "submit") {
      await tx.buyer.update({ where: { id: buyer.id }, data: { status: "REQ_SUBMITTED", reqSubmittedAt: new Date() } });
      await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action: "REQ_SUBMITTED" } });
    }
  });

  revalidatePath("/buyer", "layout");
  return {
    ok: true,
    message: intent === "submit" ? "Detailed requirement submitted to FIEO for recommendation." : "Draft saved.",
  };
}
