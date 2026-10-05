"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { EVENT } from "@/lib/config";
import { buyerEntrySchema, createBuyerByFieo, SECTOR_SLOTS, splitCerts } from "@/lib/buyer-entry";
import { parseBuyerUpload } from "@/lib/buyer-bulk";
import { isMailConfigured, mailTemplates, sendMail } from "@/lib/mail";
import { storeUpload, validateUpload } from "@/lib/storage";
import { firstErrors } from "@/lib/text";
import type { DocumentKind } from "@/generated/prisma/enums";
import type { FormState } from "./auth";

const revalidateAll = () => { for (const p of ["/fieo", "/dic", "/admin"]) revalidatePath(p, "layout"); };
const FIELDS = ["name", "country", "signupEmail", "pocName", "pocDesignation", "pocEmail", "pocMobile", "organisationType", "annualSourcingValue", "sourcingTimeline", "preferredEngagement"];
const FILE_FIELDS: [string, DocumentKind][] = [["profileFile", "PROFILE"], ["credentialsFile", "CREDENTIALS"]];

/** FIEO: register one buyer (temporary login e-mailed; basic details verified; entered sectors recommended to the Directorate). */
export async function addBuyerAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("FIEO");
  const raw: Record<string, string> = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "")]));
  const certMaster = (await prisma.certification.findMany({ select: { name: true } })).map((c) => c.name);
  const items: { sectorId: string; products: string; specifications: string; quantity: string; certifications: string[] }[] = [];
  const slotOf: number[] = [];
  for (let i = 1; i <= SECTOR_SLOTS; i++) {
    const v = (k: string) => String(form.get(`${k}-${i}`) ?? "");
    for (const k of ["sector", "products", "specifications", "quantity", "certifications"]) raw[`${k}-${i}`] = v(k);
    if (!v("sector") && !v("products").trim()) continue;
    items.push({ sectorId: v("sector"), products: v("products"), specifications: v("specifications"), quantity: v("quantity"), certifications: splitCerts(v("certifications"), certMaster) });
    slotOf.push(i);
  }
  const parsed = buyerEntrySchema.safeParse({ ...raw, items });
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const [k, msg] of Object.entries(firstErrors(parsed.error, true))) {
      const m = k.match(/^items\.(\d+)\.(\w+)/);
      errors[m ? `${m[2] === "sectorId" ? "sector" : m[2]}-${slotOf[Number(m[1])]}` : k] = msg;
    }
  }
  if (parsed.success && await prisma.buyer.findUnique({ where: { signupEmail: parsed.data.signupEmail } })) {
    errors.signupEmail = "A buyer with this login e-mail is already registered.";
  }
  if (parsed.success) {
    const ids = parsed.data.items.map((i) => i.sectorId);
    const ok = new Set((await prisma.sector.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } })).map((s) => s.id));
    parsed.data.items.forEach((it, i) => { if (!ok.has(it.sectorId)) errors[`sector-${slotOf[i]}`] = "Select a sector from the list."; });
  }
  const files: { kind: DocumentKind; file: File }[] = [];
  for (const [field, kind] of FILE_FIELDS) {
    const f = form.get(field);
    if (f instanceof File && f.size > 0) { const err = validateUpload(f); if (err) errors[field] = err; else files.push({ kind, file: f }); }
  }
  if (!parsed.success || Object.keys(errors).length) return { fieldErrors: errors, error: "Please correct the highlighted fields.", data: raw };

  const passwordHash = await hashPassword(EVENT.defaultBuyerPassword);
  const r = await prisma.$transaction((tx) => createBuyerByFieo(tx, parsed.data, "FIEO", user, passwordHash));
  for (const { kind, file } of files) {
    const storedName = await storeUpload(file, r.buyer.id, kind.toLowerCase());
    await prisma.document.create({ data: { buyerId: r.buyer.id, kind, originalName: file.name.slice(0, 200), storedName, mimeType: file.type, size: file.size } });
  }
  const mail = mailTemplates.addedByFieo(r.buyer.name, r.username, EVENT.defaultBuyerPassword, r.sectors);
  const sent = await sendMail(r.buyer.signupEmail, mail.subject, mail.text);
  revalidateAll();
  return {
    ok: true,
    message: `${r.buyer.name} registered as ${r.buyer.regNo} with temporary login ${r.username}${r.sectors ? `; ${r.sectors} sector requirement${r.sectors > 1 ? "s" : ""} sent to the Directorate` : ""}. Login details ${sent === "FAILED" ? "could not be e-mailed — please share them" : `e-mailed to ${r.buyer.signupEmail}`}.`,
    data: { buyerId: r.buyer.id, username: r.username, regNo: r.buyer.regNo, ...(sent !== "SENT" || !isMailConfigured() ? { password: EVENT.defaultBuyerPassword } : {}) },
  };
}

export type BuyerBulkState = {
  error?: string;
  imported?: { regNo: string; name: string; username: string }[];
  rows?: { row: number; name: string; email: string; errors: string[] }[];
  valid?: number;
  fileName?: string;
} | undefined;

/** FIEO: bulk upload of buyers from the Excel template — check first, then import the valid rows. */
export async function buyerBulkAction(_: BuyerBulkState, form: FormData): Promise<BuyerBulkState> {
  const user = await requireUser("FIEO");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose the filled-in Excel file to upload." };
  if (file.size > 5 * 1024 * 1024) return { error: "The file is larger than 5 MB." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Upload an Excel workbook (.xlsx) — use the template from this page." };
  const { error, rows } = await parseBuyerUpload(Buffer.from(await file.arrayBuffer()));
  if (error) return { error, fileName: file.name };
  if (!rows.length) return { error: "No buyer rows found. Fill the 'Buyers' sheet from row 2.", fileName: file.name };
  const summary = rows.map(({ row, name, email, errors }) => ({ row, name, email, errors }));
  const valid = rows.filter((r) => r.data);
  if (form.get("intent") !== "import") return { rows: summary, valid: valid.length, fileName: file.name };
  if (!valid.length) return { error: "No valid rows to import. Correct the errors and upload again.", rows: summary, valid: 0, fileName: file.name };

  const passwordHash = await hashPassword(EVENT.defaultBuyerPassword);
  const made = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const r of valid) out.push(await createBuyerByFieo(tx, r.data!, "BULK", user, passwordHash));
    return out;
  }, { timeout: 120_000 });
  for (const r of made) {
    const m = mailTemplates.addedByFieo(r.buyer.name, r.username, EVENT.defaultBuyerPassword, r.sectors);
    await sendMail(r.buyer.signupEmail, m.subject, m.text);
  }
  revalidateAll();
  return { imported: made.map((r) => ({ regNo: r.buyer.regNo, name: r.buyer.name, username: r.username })), rows: summary.filter((r) => r.errors.length), valid: 0, fileName: file.name };
}
