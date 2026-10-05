import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { ENGAGEMENT_TYPES, EVENT, ORGANISATION_TYPES, SOURCING_TIMELINES, SOURCING_VALUES } from "@/lib/config";
import { COUNTRIES } from "@/lib/countries";
import { buyerEntrySchema, SECTOR_SLOTS, splitCerts, type BuyerEntry } from "@/lib/buyer-entry";
import { firstErrors } from "@/lib/text";
import { C } from "@/lib/reports/theme";

export const MAX_ROWS = 500;

export const COLUMNS = [
  { key: "name", header: "Name of Buyer", width: 32, required: true },
  { key: "country", header: "Country", width: 22, required: true },
  { key: "signupEmail", header: "Login E-mail", width: 30, required: true },
  { key: "pocName", header: "Contact Person", width: 24, required: true },
  { key: "pocDesignation", header: "Designation", width: 22, required: true },
  { key: "pocEmail", header: "Contact E-mail", width: 30, required: true },
  { key: "pocMobile", header: "Mobile (with country code)", width: 22, required: true },
  { key: "organisationType", header: "Organisation Type", width: 24, required: false },
  { key: "annualSourcingValue", header: "Annual Sourcing Value", width: 22, required: false },
  { key: "sourcingTimeline", header: "Sourcing Timeline", width: 22, required: false },
  { key: "preferredEngagement", header: "Preferred Engagement", width: 26, required: false },
  ...Array.from({ length: SECTOR_SLOTS }, (_, i) => [
    { key: `sector${i + 1}`, header: `Sector ${i + 1}`, width: 28, required: false },
    { key: `products${i + 1}`, header: `Products ${i + 1}`, width: 34, required: false },
    { key: `specifications${i + 1}`, header: `Specifications ${i + 1}`, width: 30, required: false },
    { key: `quantity${i + 1}`, header: `Quantity ${i + 1}`, width: 20, required: false },
    { key: `certifications${i + 1}`, header: `Certifications ${i + 1}`, width: 30, required: false },
  ]).flat(),
] as const;

const argb = (h: string) => `FF${h}`;

/** Upload template: instructions + 'Buyers' sheet with drop-down lists + reference lists. */
export async function buildBuyerTemplate() {
  const [sectors, certs] = await Promise.all([
    prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true } }),
    prisma.certification.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  const wb = new ExcelJS.Workbook();
  wb.creator = `${EVENT.name} ${EVENT.short} Portal`;
  const ins = wb.addWorksheet("Instructions", { views: [{ showGridLines: false }] });
  ins.columns = [{ width: 4 }, { width: 110 }];
  const lines: [string, Partial<ExcelJS.Font>][] = [
    [`${EVENT.name} · ${EVENT.programme}`.toUpperCase(), { bold: true, size: 10, color: { argb: argb(C.brand) } }],
    ["Buyer bulk upload template (FIEO)", { bold: true, size: 18, color: { argb: argb(C.ink) } }],
    ["Each buyer gets a temporary login (Tradex2027-NNN), e-mailed to the Login E-mail. It becomes the buyer's permanent login once the Directorate approves the buyer.", { size: 11, color: { argb: argb(C.muted) } }],
    ["", {}],
    ["How to fill", { bold: true, size: 12, color: { argb: argb(C.brandDark) } }],
    ["1. One buyer per row in the 'Buyers' sheet, from row 2. Do not change the heading row.", {}],
    ["2. English characters only. Country: choose from the drop-down (the full list is in 'Country list').", {}],
    ["3. Login E-mail must be unique — the buyer signs in with the login ID sent to it. Contact person, designation, contact e-mail and mobile (with country code, e.g. +971 50 123 4567) are required.", {}],
    ["4. Basic details entered here count as verified by FIEO.", {}],
    [`5. Sector requirements are optional (up to ${SECTOR_SLOTS}). For each one give the Sector (drop-down) and Products; specifications, quantity and certifications are optional. Certifications: separate with semicolons (names in 'Certification list').`, {}],
    ["6. Sector requirements given here go straight to the Directorate as recommended by FIEO. When any are given, Organisation Type, Annual Sourcing Value and Sourcing Timeline are required (drop-downs).", {}],
    [`7. Up to ${MAX_ROWS} rows per file. Upload on the portal, check the result, then click 'Import'. Rows with errors are listed and skipped.`, {}],
  ];
  lines.forEach(([t, f], i) => {
    const c = ins.getCell(i + 1, 2);
    c.value = t; c.font = { name: "Calibri", size: 11, color: { argb: argb(C.ink) }, ...f }; c.alignment = { wrapText: true, vertical: "middle" };
    ins.getRow(i + 1).height = i === 1 ? 28 : i === 2 || i >= 7 ? 32 : 18;
  });
  const lists = wb.addWorksheet("Lists", { state: "veryHidden" });
  const cols: (readonly string[])[] = [sectors.map((s) => s.name), COUNTRIES, ORGANISATION_TYPES, SOURCING_VALUES, SOURCING_TIMELINES, ENGAGEMENT_TYPES];
  cols.forEach((vals, c) => vals.forEach((v, r) => (lists.getCell(r + 1, c + 1).value = v)));

  const ws = wb.addWorksheet("Buyers", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));
  const head = ws.getRow(1);
  COLUMNS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header + (c.required ? " *" : "");
    cell.font = { bold: true, color: { argb: argb(C.white) } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(c.required ? C.brand : "64748B") } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
  });
  head.height = 32;
  const letter = (key: string) => ws.getColumn(COLUMNS.findIndex((c) => c.key === key) + 1).letter;
  const list = (key: string, col: string, n: number) => {
    const L = letter(key);
    (ws as unknown as { dataValidations: { add: (range: string, v: ExcelJS.DataValidation) => void } }).dataValidations.add(`${L}2:${L}${MAX_ROWS + 1}`,
      { type: "list", allowBlank: true, formulae: [`Lists!$${col}$1:$${col}$${n}`], showErrorMessage: true, errorTitle: "Invalid value", error: "Choose a value from the list." });
  };
  list("country", "B", COUNTRIES.length);
  list("organisationType", "C", ORGANISATION_TYPES.length);
  list("annualSourcingValue", "D", SOURCING_VALUES.length);
  list("sourcingTimeline", "E", SOURCING_TIMELINES.length);
  list("preferredEngagement", "F", ENGAGEMENT_TYPES.length);
  for (let i = 1; i <= SECTOR_SLOTS; i++) list(`sector${i}`, "A", sectors.length);
  const L = letter("pocMobile");
  for (let r = 2; r <= 200; r++) ws.getCell(`${L}${r}`).numFmt = "@";
  const cl = wb.addWorksheet("Certification list");
  cl.columns = [{ header: "Certification (copy the name exactly)", key: "n", width: 50 }];
  cl.getRow(1).font = { bold: true };
  certs.forEach((c) => cl.addRow({ n: c.name }));
  const co = wb.addWorksheet("Country list");
  co.columns = [{ header: "Country (copy the name exactly)", key: "n", width: 40 }];
  co.getRow(1).font = { bold: true };
  COUNTRIES.forEach((c) => co.addRow({ n: c }));
  wb.views = [{ activeTab: 2, x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export type BuyerRow = { row: number; name: string; email: string; errors: string[]; data?: BuyerEntry };

const cellText = (c: ExcelJS.Cell) => {
  const v = c.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.round(v) === v ? v.toFixed(0) : v);
  if (typeof v === "object" && "text" in v && typeof v.text === "string") return v.text;
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(c.text ?? v).trim();
};
const LABEL: Record<string, string> = Object.fromEntries(COLUMNS.map((c) => [c.key, c.header]));

/** Reads and checks an uploaded workbook; nothing is saved here. */
export async function parseBuyerUpload(buf: Buffer): Promise<{ error?: string; rows: BuyerRow[] }> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as unknown as ExcelJS.Buffer); } catch {
    return { error: "The file could not be read. Please upload the Excel (.xlsx) template downloaded from this page.", rows: [] };
  }
  const ws = wb.getWorksheet("Buyers") ?? wb.worksheets.find((w) => w.state === "visible" && w.name !== "Instructions");
  if (!ws) return { error: "No 'Buyers' sheet found in the file.", rows: [] };
  const idx: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, n) => {
    const h = cellText(cell).replace(/\s*\*$/, "").trim().toLowerCase();
    const c = COLUMNS.find((x) => x.header.toLowerCase() === h);
    if (c) idx[c.key] = n;
  });
  const missing = COLUMNS.filter((c) => c.required && !idx[c.key]).map((c) => c.header);
  if (missing.length) return { error: `The heading row is missing: ${missing.join(", ")}. Please use the template from this page.`, rows: [] };

  const sectors = await prisma.sector.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const byName = new Map(sectors.map((s) => [s.name.toLowerCase().replace(/\s+/g, " "), s.id]));
  const certMaster = (await prisma.certification.findMany({ select: { name: true } })).map((c) => c.name);
  const ALIAS: Record<string, string> = { uae: "United Arab Emirates", usa: "United States", us: "United States", uk: "United Kingdom" };
  const country = (v: string) => ALIAS[v.toLowerCase()] ?? COUNTRIES.find((c) => c.toLowerCase() === v.toLowerCase()) ?? v;
  const choose = (list: readonly string[], v: string) => list.find((x) => x.toLowerCase() === v.toLowerCase()) ?? v;

  const rows: BuyerRow[] = [];
  const last = ws.actualRowCount ? ws.rowCount : 1;
  for (let r = 2; r <= last; r++) {
    const row = ws.getRow(r);
    const get = (k: string) => (idx[k] ? cellText(row.getCell(idx[k])) : "");
    if (COLUMNS.every((c) => !get(c.key))) continue;
    if (rows.length >= MAX_ROWS) return { error: `Too many rows: the limit is ${MAX_ROWS} per file.`, rows: [] };
    const errors: string[] = [];
    const items: BuyerEntry["items"] = [];
    const slotOf: number[] = [];
    for (let i = 1; i <= SECTOR_SLOTS; i++) {
      const s = get(`sector${i}`), p = get(`products${i}`);
      if (!s && !p) continue;
      const sectorId = byName.get(s.toLowerCase().replace(/\s+/g, " "));
      if (!sectorId) { errors.push(`Sector ${i}: "${s || "(blank)"}" is not in the sector list.`); continue; }
      items.push({ sectorId, products: p, specifications: get(`specifications${i}`), quantity: get(`quantity${i}`), certifications: splitCerts(get(`certifications${i}`), certMaster) });
      slotOf.push(i);
    }
    const raw = {
      name: get("name"), country: country(get("country")), signupEmail: get("signupEmail"),
      pocName: get("pocName"), pocDesignation: get("pocDesignation"), pocEmail: get("pocEmail"), pocMobile: get("pocMobile"),
      organisationType: choose(ORGANISATION_TYPES, get("organisationType")), annualSourcingValue: choose(SOURCING_VALUES, get("annualSourcingValue")),
      sourcingTimeline: choose(SOURCING_TIMELINES, get("sourcingTimeline")), preferredEngagement: choose(ENGAGEMENT_TYPES, get("preferredEngagement")),
      items,
    };
    const parsed = buyerEntrySchema.safeParse(raw);
    if (!parsed.success) {
      for (const [k, msg] of Object.entries(firstErrors(parsed.error, true))) {
        const m = k.match(/^items\.(\d+)\.(\w+)/);
        const label = m ? `${m[2] === "sectorId" ? "Sector" : m[2][0].toUpperCase() + m[2].slice(1)} ${slotOf[Number(m[1])]}` : LABEL[k] ?? k;
        errors.push(msg.startsWith(label) ? msg : `${label}: ${msg}`);
      }
    }
    rows.push({ row: r, name: parsed.success ? parsed.data.name : raw.name, email: parsed.success ? parsed.data.signupEmail : raw.signupEmail, errors,
      data: parsed.success && !errors.length ? parsed.data : undefined });
  }
  // Login e-mails must be unique — within the file and against registered buyers (checked on every row, so all problems show at once).
  const key = (r: BuyerRow) => (r.data?.signupEmail ?? r.email).trim().toLowerCase();
  const seen = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const first = seen.get(k);
    if (first) { r.errors.push(`Login e-mail repeats row ${first} of this file.`); r.data = undefined; } else seen.set(k, r.row);
  }
  const taken = await prisma.buyer.findMany({ where: { signupEmail: { in: [...seen.keys()] } }, select: { signupEmail: true, regNo: true } });
  for (const r of rows) {
    const t = taken.find((x) => x.signupEmail === key(r));
    if (t) { r.errors.push(`Login e-mail already registered (${t.regNo}).`); r.data = undefined; }
  }
  return { rows };
}
