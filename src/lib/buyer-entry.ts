import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { BuyerSource } from "@/generated/prisma/enums";
import { COUNTRIES } from "@/lib/countries";
import { buyerRegNo, buyerUsername, ENGAGEMENT_TYPES, ORGANISATION_TYPES, SOURCING_TIMELINES, SOURCING_VALUES } from "@/lib/config";
import { nextSeq } from "@/lib/sequence";
import { designation, emailField, englishText, mobileField, orgName, personName } from "@/lib/text";

/** Sector requirement slots on the FIEO entry form and the bulk template. */
export const SECTOR_SLOTS = 3;

const pick = (list: readonly string[], label: string) =>
  z.string().refine((v) => v === "" || list.includes(v), `${label}: choose a value from the list.`).transform((v) => v || null);

export const buyerEntrySchema = z.object({
  name: orgName(),
  country: z.string().refine((c) => COUNTRIES.includes(c), "Select the country from the list."),
  signupEmail: emailField("Enter the buyer's login e-mail, e.g. purchase@company.com."),
  pocName: personName("Contact name"),
  pocDesignation: designation(),
  pocEmail: emailField(),
  pocMobile: mobileField(),
  organisationType: pick(ORGANISATION_TYPES, "Organisation type"),
  annualSourcingValue: pick(SOURCING_VALUES, "Annual sourcing value"),
  sourcingTimeline: pick(SOURCING_TIMELINES, "Sourcing timeline"),
  preferredEngagement: pick(ENGAGEMENT_TYPES, "Preferred engagement"),
  items: z.array(z.object({
    sectorId: z.string().min(1, "Select a sector."),
    products: englishText({ min: 2, max: 1000, label: "Products", multiline: true }),
    specifications: englishText({ max: 2000, label: "Specifications", multiline: true }),
    quantity: englishText({ max: 200, label: "Quantity" }),
    certifications: z.array(englishText({ min: 1, max: 120, label: "Certification" })).max(40),
  })).max(SECTOR_SLOTS),
}).superRefine((d, ctx) => {
  // Sector requirements go to the Directorate at once, so the sourcing profile must be complete.
  if (d.items.length) {
    for (const [k, label] of [["organisationType", "organisation type"], ["annualSourcingValue", "annual sourcing value"], ["sourcingTimeline", "sourcing timeline"]] as const) {
      if (!d[k]) ctx.addIssue({ code: "custom", path: [k], message: `Choose the ${label} — needed when sector requirements are entered.` });
    }
  }
  const seen = new Set<string>();
  d.items.forEach((it, i) => {
    if (seen.has(it.sectorId)) ctx.addIssue({ code: "custom", path: ["items", i, "sectorId"], message: "The same sector is entered twice." });
    seen.add(it.sectorId);
  });
});
export type BuyerEntry = z.infer<typeof buyerEntrySchema>;

/**
 * Creates a buyer entered by FIEO with a temporary login (e-mailed by the caller): basic details count as verified by
 * FIEO, and any sector requirements go straight to the Directorate as recommended by FIEO. The login becomes the
 * buyer's permanent login once the Directorate approves the first sector.
 */
export async function createBuyerByFieo(tx: Prisma.TransactionClient, d: BuyerEntry, source: Exclude<BuyerSource, "SELF">, actor: { id: string }, passwordHash: string) {
  const now = new Date();
  const seq = await nextSeq(tx, "buyer");
  const user = await tx.user.create({
    data: { username: buyerUsername(seq), passwordHash, role: "BUYER", displayName: d.name, mustChangePassword: true },
  });
  const hasItems = d.items.length > 0;
  const buyer = await tx.buyer.create({
    data: {
      userId: user.id, seq, regNo: buyerRegNo(seq), name: d.name, country: d.country, signupEmail: d.signupEmail,
      pocName: d.pocName, pocDesignation: d.pocDesignation, pocEmail: d.pocEmail, pocMobile: d.pocMobile,
      status: "BASIC_APPROVED", basicSubmittedAt: now, basicApprovedAt: now, source, createdById: actor.id,
      ...(hasItems ? { reqSubmittedAt: now, recommendedAt: now } : {}),
    },
  });
  const how = source === "BULK" ? "Added by FIEO through bulk upload" : "Added by FIEO";
  await tx.reviewLog.createMany({ data: [
    { buyerId: buyer.id, actorId: actor.id, actorRole: "FIEO", action: "SIGNED_UP", comment: `${how} — temporary login ${user.username}` },
    { buyerId: buyer.id, actorId: actor.id, actorRole: "FIEO", action: "BASIC_APPROVED", comment: "Basic details entered by FIEO" },
  ] });
  const req = await tx.requirement.create({
    data: { buyerId: buyer.id, organisationType: d.organisationType, annualSourcingValue: d.annualSourcingValue, sourcingTimeline: d.sourcingTimeline, preferredEngagement: d.preferredEngagement },
  });
  for (const [i, it] of d.items.entries()) {
    const item = await tx.requirementItem.create({
      data: {
        requirementId: req.id, sectorId: it.sectorId, products: it.products, specifications: it.specifications || null, quantity: it.quantity || null,
        certifications: JSON.stringify([...new Set(it.certifications)]), sortOrder: i,
        status: "FIEO_RECOMMENDED", submittedAt: now, recommendedAt: now,
      },
      include: { sector: { select: { name: true } } },
    });
    await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: actor.id, actorRole: "FIEO", action: "FIEO_RECOMMENDED", itemId: item.id, sectorName: item.sector.name, comment: "Entered and recommended by FIEO" } });
  }
  return { buyer, username: user.username, sectors: d.items.length };
}

/** "ISO 9001; haccp" → master names where they match (case-insensitive, with or without the bracketed part), else as typed. */
export function splitCerts(text: string, master: string[]) {
  return text.split(/[;\n]/).map((x) => x.trim()).filter(Boolean).map((v) => {
    const k = v.toLowerCase();
    return master.find((n) => n.toLowerCase() === k || n.toLowerCase().startsWith(`${k} (`)) ?? v;
  });
}
