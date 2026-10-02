import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { EVENT, LOCAL_BODY_TYPES } from "@/lib/config";
import { sellerSchema, type SellerData } from "@/lib/seller-schema";
import { firstErrors } from "@/lib/text";
import { C } from "@/lib/reports/theme";

export const MAX_ROWS = 1000;
const SECTOR_SLOTS = 3;

// Column order of the upload template (district is fixed to the uploading office).
export const COLUMNS = [
  { key: "name", header: "Name of Seller", width: 32, required: true },
  { key: "taluk", header: "Taluk", width: 18, required: true },
  { key: "localBodyType", header: "Local Body Type", width: 18, required: true },
  { key: "localBodyName", header: "Local Body Name", width: 22, required: true },
  { key: "udyamNo", header: "Udyam Number", width: 24, required: true },
  { key: "exportExperience", header: "Export Experience", width: 16, required: true },
  { key: "contactName", header: "Contact Person Name", width: 24, required: true },
  { key: "contactMobile", header: "Mobile Number", width: 16, required: true },
  { key: "contactWhatsapp", header: "WhatsApp Number", width: 16, required: true },
  { key: "contactEmail", header: "E-mail", width: 28, required: true },
  ...Array.from({ length: SECTOR_SLOTS }, (_, i) => [
    { key: `sector${i + 1}`, header: `Sector ${i + 1}`, width: 28, required: i === 0 },
    { key: `products${i + 1}`, header: `Products ${i + 1}`, width: 36, required: i === 0 },
  ]).flat(),
] as const;

const argb = (h: string) => `FF${h}`;

/** Upload template: instructions sheet + data sheet with drop-down lists. */
export async function buildTemplate(district: string) {
  const sectors = await prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const wb = new ExcelJS.Workbook();
  wb.creator = `${EVENT.name} ${EVENT.short} Portal`;

  const ins = wb.addWorksheet("Instructions", { views: [{ showGridLines: false }] });
  ins.columns = [{ width: 4 }, { width: 110 }];
  const lines: [string, Partial<ExcelJS.Font>][] = [
    [`${EVENT.name} · ${EVENT.programme}`.toUpperCase(), { bold: true, size: 10, color: { argb: argb(C.brand) } }],
    ["Seller bulk upload template", { bold: true, size: 18, color: { argb: argb(C.ink) } }],
    [`District Industries Centre: ${district}. All sellers in this file are registered under ${district}.`, { size: 11, color: { argb: argb(C.muted) } }],
    ["", {}],
    ["How to fill", { bold: true, size: 12, color: { argb: argb(C.brandDark) } }],
    ["1. Enter one seller per row in the 'Sellers' sheet, starting from row 2. Do not change or move the heading row.", {}],
    ["2. Use English characters only. Names are formatted automatically (e.g. 'abc exports' becomes 'Abc Exports').", {}],
    ["3. Local Body Type: choose Panchayat, Municipality or Corporation from the drop-down.", {}],
    ["4. Udyam Number: Kerala Udyam numbers only, in the format UDYAM-KL-00-0000000 (e.g. UDYAM-KL-07-0012345).", {}],
    ["5. Export Experience: choose Yes or No.", {}],
    ["6. Mobile / WhatsApp: 10-digit Indian mobile numbers (e.g. 9876543210). Repeat the mobile number if WhatsApp is the same.", {}],
    [`7. Sector 1 and Products 1 are required; up to ${SECTOR_SLOTS} sectors can be given. Pick sectors from the drop-down; separate products with commas.`, {}],
    [`8. Up to ${MAX_ROWS} rows per file. Upload the file on the portal, check the preview, then click 'Import'. Rows with errors are skipped and listed.`, {}],
    ["9. After import, review the sellers and recommend them to the Directorate from the Sellers page.", {}],
  ];
  lines.forEach(([t, f], i) => {
    const c = ins.getCell(i + 1, 2);
    c.value = t;
    c.font = { name: "Calibri", size: 11, color: { argb: argb(C.ink) }, ...f };
    c.alignment = { wrapText: true, vertical: "middle" };
    ins.getRow(i + 1).height = i === 1 ? 28 : 18;
  });

  const lists = wb.addWorksheet("Lists", { state: "veryHidden" });
  sectors.forEach((s, i) => (lists.getCell(i + 1, 1).value = s.name));
  LOCAL_BODY_TYPES.forEach((t, i) => (lists.getCell(i + 1, 2).value = t.label));
  ["Yes", "No"].forEach((t, i) => (lists.getCell(i + 1, 3).value = t));

  const ws = wb.addWorksheet("Sellers", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));
  const head = ws.getRow(1);
  COLUMNS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header + (c.required ? " *" : "");
    cell.font = { bold: true, color: { argb: argb(C.white) } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(c.required ? C.brand : "64748B") } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
  });
  head.height = 30;
  const col = (key: string) => ws.getColumn(COLUMNS.findIndex((c) => c.key === key) + 1).letter;
  const list = (key: string, formula: string) => {
    const L = col(key);
    // Range validations exist at runtime (exceljs ≥ 4.3) but are missing from its typings.
    (ws as unknown as { dataValidations: { add: (range: string, v: ExcelJS.DataValidation) => void } }).dataValidations.add(`${L}2:${L}${MAX_ROWS + 1}`, { type: "list", allowBlank: true, formulae: [formula], showErrorMessage: true, errorTitle: "Invalid value", error: "Choose a value from the list." });
  };
  list("localBodyType", `Lists!$B$1:$B$${LOCAL_BODY_TYPES.length}`);
  list("exportExperience", "Lists!$C$1:$C$2");
  for (let i = 1; i <= SECTOR_SLOTS; i++) list(`sector${i}`, `Lists!$A$1:$A$${sectors.length}`);
  for (const k of ["contactMobile", "contactWhatsapp", "udyamNo"]) {
    const L = col(k);
    for (let r = 2; r <= 200; r++) ws.getCell(`${L}${r}`).numFmt = "@"; // keep as text (no 9.88E+09)
  }
  wb.views = [{ activeTab: 2, x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export type RowResult = { row: number; name: string; udyamNo: string; errors: string[]; data?: SellerData };

const cellText = (c: ExcelJS.Cell) => {
  const v = c.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.round(v) === v ? v.toFixed(0) : v);
  if (typeof v === "object" && "text" in v && typeof v.text === "string") return v.text; // hyperlink cells (e-mails)
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(c.text ?? v).trim();
};

const FIELD_LABEL: Record<string, string> = Object.fromEntries(COLUMNS.map((c) => [c.key, c.header]));

/** Reads and validates an uploaded workbook. Nothing is written to the database here. */
export async function parseUpload(buf: Buffer, district: string): Promise<{ error?: string; rows: RowResult[] }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  } catch {
    return { error: "The file could not be read. Please upload the Excel (.xlsx) template downloaded from this page.", rows: [] };
  }
  const ws = wb.getWorksheet("Sellers") ?? wb.worksheets.find((w) => w.state === "visible" && w.name !== "Instructions");
  if (!ws) return { error: "No 'Sellers' sheet found in the file.", rows: [] };

  // Map columns by heading text so re-ordered columns still work.
  const idx: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, n) => {
    const h = cellText(cell).replace(/\s*\*$/, "").trim().toLowerCase();
    const c = COLUMNS.find((x) => x.header.toLowerCase() === h);
    if (c) idx[c.key] = n;
  });
  const missing = COLUMNS.filter((c) => c.required && !idx[c.key]).map((c) => c.header);
  if (missing.length) return { error: `The heading row is missing: ${missing.join(", ")}. Please use the template from this page.`, rows: [] };

  const sectors = await prisma.sector.findMany({ where: { isActive: true } });
  const byName = new Map(sectors.map((s) => [s.name.toLowerCase().replace(/\s+/g, " "), s.id]));
  const lbt = new Map(LOCAL_BODY_TYPES.map((t) => [t.label.toLowerCase(), t.value]));

  const rows: RowResult[] = [];
  const last = ws.actualRowCount ? ws.rowCount : 1;
  for (let r = 2; r <= last; r++) {
    const row = ws.getRow(r);
    const get = (k: string) => (idx[k] ? cellText(row.getCell(idx[k])) : "");
    if (COLUMNS.every((c) => !get(c.key))) continue; // blank row
    if (rows.length >= MAX_ROWS) return { error: `Too many rows: the limit is ${MAX_ROWS} per file.`, rows: [] };

    const errors: string[] = [];
    const products: { sectorId: string; products: string }[] = [];
    for (let i = 1; i <= SECTOR_SLOTS; i++) {
      const sName = get(`sector${i}`), prod = get(`products${i}`);
      if (!sName && !prod) continue;
      const sectorId = byName.get(sName.toLowerCase().replace(/\s+/g, " "));
      if (!sectorId) errors.push(`Sector ${i}: "${sName || "(blank)"}" is not in the sector list.`);
      else products.push({ sectorId, products: prod });
    }
    const raw = {
      name: get("name"), district, taluk: get("taluk"),
      localBodyType: lbt.get(get("localBodyType").toLowerCase()) ?? get("localBodyType"),
      localBodyName: get("localBodyName"), udyamNo: get("udyamNo"),
      exportExperience: get("exportExperience").toUpperCase() === "Y" ? "YES" : get("exportExperience").toUpperCase(),
      contactName: get("contactName"), contactMobile: get("contactMobile"),
      contactWhatsapp: get("contactWhatsapp") || get("contactMobile"), contactEmail: get("contactEmail"), products,
    };
    const parsed = sellerSchema.safeParse(raw);
    if (!parsed.success) {
      for (const [k, msg] of Object.entries(firstErrors(parsed.error, true))) {
        if (k === "products" && errors.some((e) => e.startsWith("Sector"))) continue; // already explained
        const label = FIELD_LABEL[k] ?? (k.startsWith("products") ? "Products" : k);
        errors.push(msg.includes(":") || msg.startsWith("Enter") || msg.startsWith("Select") || msg.startsWith("Only") || msg.startsWith("Add") ? msg : `${label}: ${msg}`);
      }
    }
    rows.push({ row: r, name: parsed.success ? parsed.data.name : raw.name, udyamNo: parsed.success ? parsed.data.udyamNo : raw.udyamNo, errors, data: parsed.success && !errors.length ? parsed.data : undefined });
  }

  // Duplicates within the file and against existing registrations.
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (!r.data) continue;
    const first = seen.get(r.data.udyamNo);
    if (first) { r.errors.push(`Udyam number repeats row ${first} of this file.`); r.data = undefined; }
    else seen.set(r.data.udyamNo, r.row);
  }
  const existing = await prisma.seller.findMany({ where: { udyamNo: { in: [...seen.keys()] } }, select: { udyamNo: true, regNo: true, district: true } });
  for (const r of rows) {
    const e = r.data && existing.find((x) => x.udyamNo === r.data!.udyamNo);
    if (e) { r.errors.push(`Udyam number already registered (${e.regNo}, ${e.district}).`); r.data = undefined; }
  }
  return { rows };
}
