import "server-only";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EVENT } from "@/lib/config";
import { ITEM_META, SELLER_META, STATUS_META } from "@/lib/status";
import { fmtDateTime } from "@/lib/format";
import type { BuyerStatus, ItemStatus, SellerStatus } from "@/generated/prisma/enums";
import { C, TONE } from "./theme";
import type { Column, Report, Row, Table } from "./types";

const argb = (hex: string) => `FF${hex}`;
const thin = { style: "thin" as const, color: { argb: argb(C.border) } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const fmtStamp = fmtDateTime;

function statusOf(col: Column, v: Row[string]) {
  if (col.kind === "buyerStatus" && typeof v === "string" && v in STATUS_META) return STATUS_META[v as BuyerStatus];
  if (col.kind === "itemStatus" && typeof v === "string" && v in ITEM_META) return ITEM_META[v as ItemStatus];
  if (col.kind === "sellerStatus" && typeof v === "string" && v in SELLER_META) return SELLER_META[v as SellerStatus];
  return null;
}

// Excel stores dates without a time zone; shift to Indian Standard Time so the
// calendar day matches what the portal shows.
const IST_MS = 330 * 60 * 1000;

function cellValue(col: Column, v: Row[string]) {
  if (v === null || v === undefined || v === "") return col.kind === "number" ? null : "—";
  const st = statusOf(col, v);
  if (st) return st.label;
  if (v instanceof Date) return new Date(v.getTime() + IST_MS);
  return v;
}

let logoCache: Buffer | null = null;
async function logo() {
  logoCache ??= await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "tradex-logo.png"));
  return logoCache;
}

function addSheet(wb: ExcelJS.Workbook, report: Report, table: Table, logoId: number) {
  const ws = wb.addWorksheet(table.name.slice(0, 31), {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: report.orientation === "landscape" || table.columns.length > 6 ? "landscape" : "portrait",
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 },
      horizontalCentered: true,
    },
    headerFooter: {
      oddFooter: `&L&8${EVENT.name} ${EVENT.short} · ${report.title}&C&8Page &P of &N&R&8Generated ${fmtStamp(report.generatedAt)}`,
    },
  });
  const n = table.columns.length;
  ws.columns = table.columns.map((c) => ({ key: c.key, width: c.width }));

  // ---- letterhead: logo row, event line, title, description, generated-on, ribbon
  ws.getRow(1).height = 44;
  ws.addImage(logoId, { tl: { col: 0.1, row: 0.12 }, ext: { width: 128, height: 44 }, editAs: "absolute" });
  const lines: [string, Partial<ExcelJS.Font>, number][] = [
    [`${EVENT.name.toUpperCase()}  ·  ${EVENT.programme.toUpperCase()}  ·  ${EVENT.organiser.toUpperCase()}`, { size: 9, bold: true, color: { argb: argb(C.brand) } }, 16],
    [report.title + (table.heading && report.tables.length > 1 ? ` — ${table.heading.replace(/^\d+\.\s*/, "")}` : ""), { size: 18, bold: true, color: { argb: argb(C.ink) } }, 28],
    [report.description, { size: 10, color: { argb: argb(C.muted) } }, 16],
    [`Generated on ${fmtStamp(report.generatedAt)} by ${report.generatedBy}` + (report.id.endsWith("-profile") ? "" : "   |   " +
      (report.filters.length ? `Filters: ${report.filters.join("; ")}` : "Filters: none (all records)")), { size: 9, italic: true, color: { argb: argb(C.muted) } }, 15],
  ];
  lines.forEach(([text, font, height], i) => {
    const r = i + 2;
    ws.mergeCells(r, 1, r, n);
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.font = { name: "Calibri", ...font };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(r).height = height;
  });

  // Four-colour ribbon.
  ws.getRow(6).height = 5;
  const seg = Math.max(1, Math.round(n / 4));
  const ribbon = [C.red, C.yellow, C.green, C.blue];
  for (let i = 1; i <= n; i++) {
    ws.getCell(6, i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(ribbon[Math.min(3, Math.floor((i - 1) / seg))]) } };
  }

  let row = 8;
  // ---- KPI summary (first sheet only)
  if (report.kpis.length && table === report.tables[0]) {
    const tone = (k: Report["kpis"][number]) => TONE[k.tone === "yellow" ? "amber" : k.tone ?? "slate"];
    if (n >= report.kpis.length) {
      // One box per KPI across the sheet.
      const span = Math.floor(n / report.kpis.length);
      report.kpis.forEach((k, i) => {
        const c1 = 1 + i * span;
        const c2 = i === report.kpis.length - 1 ? n : c1 + span - 1;
        if (c2 > c1) { ws.mergeCells(row, c1, row, c2); ws.mergeCells(row + 1, c1, row + 1, c2); }
        const t = tone(k);
        const lab = ws.getCell(row, c1);
        lab.value = k.label.toUpperCase();
        lab.font = { size: 8, bold: true, color: { argb: argb(t.text) } };
        const val = ws.getCell(row + 1, c1);
        val.value = k.value;
        val.font = { size: 16, bold: true, color: { argb: argb(C.ink) } };
        for (let c = c1; c <= c2; c++) for (const rr of [row, row + 1]) {
          const cell = ws.getCell(rr, c);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(t.fill) } };
          cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
        }
      });
      ws.getRow(row).height = 18;
      ws.getRow(row + 1).height = 26;
      row += 3;
    } else {
      // Narrow sheet: label / value list.
      report.kpis.forEach((k) => {
        const t = tone(k);
        const lab = ws.getCell(row, 1);
        lab.value = k.label;
        lab.font = { size: 10, bold: true, color: { argb: argb(t.text) } };
        const val = ws.getCell(row, 2);
        val.value = k.value;
        val.font = { size: 12, bold: true, color: { argb: argb(C.ink) } };
        val.alignment = { horizontal: "right" };
        for (const c of [1, 2]) {
          ws.getCell(row, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(t.fill) } };
          ws.getCell(row, c).border = BORDER;
        }
        lab.alignment = { indent: 1, vertical: "middle" };
        ws.getRow(row).height = 20;
        row++;
      });
      row++;
    }
  }

  // ---- table header
  const headerRow = ws.getRow(row);
  table.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10, color: { argb: argb(C.white) } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(C.brand) } };
    cell.alignment = { vertical: "middle", horizontal: c.align ?? "left", wrapText: true, indent: c.align ? 0 : 1 };
    cell.border = { ...BORDER, top: { style: "thin", color: { argb: argb(C.brandDark) } }, bottom: { style: "medium", color: { argb: argb(C.brandDark) } } };
  });
  headerRow.height = 30;
  const headerIndex = row;
  ws.views = [{ state: "frozen", ySplit: headerIndex, showGridLines: false }];
  ws.pageSetup.printTitlesRow = `${headerIndex}:${headerIndex}`;

  // ---- rows
  table.rows.forEach((r, idx) => {
    row++;
    const xr = ws.getRow(row);
    table.columns.forEach((c, i) => {
      const cell = xr.getCell(i + 1);
      const v = r[c.key];
      cell.value = cellValue(c, v) as ExcelJS.CellValue;
      cell.border = BORDER;
      cell.font = { size: 10, color: { argb: argb(C.ink) }, ...(c.kind === "mono" ? { name: "Consolas" } : {}) };
      cell.alignment = { vertical: "top", horizontal: c.align ?? "left", wrapText: true, indent: c.align ? 0 : 1 };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(C.zebra) } };
      if (c.kind === "date" && v instanceof Date) cell.numFmt = "dd-mmm-yyyy";
      if (c.kind === "datetime" && v instanceof Date) cell.numFmt = "dd-mmm-yyyy hh:mm AM/PM";
      if ((c.kind === "date" || c.kind === "datetime") && !(v instanceof Date)) cell.alignment = { ...cell.alignment, horizontal: "center" };
      if (c.kind === "percent") cell.numFmt = "0.0%";
      const st = statusOf(c, v);
      if (st) {
        const tone = TONE[st.tone];
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(tone.fill) } };
        cell.font = { size: 10, bold: true, color: { argb: argb(tone.text) } };
      }
      if (cell.value === "—") cell.font = { ...cell.font, color: { argb: argb("94A3B8") } };
    });
    // Rough row height so wrapped text is visible when opened.
    const lines = Math.max(1, ...table.columns.map((c) => {
      const v = r[c.key];
      if (v instanceof Date || typeof v === "number") return 1;
      const st = statusOf(c, v);
      const s = st ? st.label : String(v ?? "");
      return s.split("\n").reduce((n, part) => n + Math.max(1, Math.ceil(part.length / Math.max(4, c.width - 2))), 0);
    }));
    xr.height = Math.min(160, 15 * lines + 4);
  });

  if (!table.rows.length) {
    row++;
    ws.mergeCells(row, 1, row, n);
    const cell = ws.getCell(row, 1);
    cell.value = "No records match the selected filters.";
    cell.font = { italic: true, color: { argb: argb(C.muted) } };
    cell.alignment = { horizontal: "center" };
    cell.border = BORDER;
  }

  // ---- totals
  if (table.totals) {
    row++;
    const tr = ws.getRow(row);
    table.columns.forEach((c, i) => {
      const cell = tr.getCell(i + 1);
      const v = table.totals![c.key];
      cell.value = (v ?? "") as ExcelJS.CellValue;
      if (c.kind === "percent") cell.numFmt = "0.0%";
      cell.font = { bold: true, size: 10, color: { argb: argb(C.ink) } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(C.brandLight) } };
      cell.border = { ...BORDER, top: { style: "medium", color: { argb: argb(C.brand) } } };
      cell.alignment = { horizontal: c.align ?? "left", indent: c.align ? 0 : 1 };
    });
    tr.height = 20;
  }

  if (table.rows.length && !table.totals) {
    ws.autoFilter = { from: { row: headerIndex, column: 1 }, to: { row: headerIndex + table.rows.length, column: n } };
  }

  // ---- closing note
  row += 2;
  ws.mergeCells(row, 1, row, n);
  const note = ws.getCell(row, 1);
  note.value = `${table.totals ? "" : `Total records: ${table.rows.length}.   `}Source: ${EVENT.name} ${EVENT.short} portal — ${EVENT.organiser}. This is a system-generated report.`;
  note.font = { size: 8, italic: true, color: { argb: argb(C.muted) } };
}

export async function reportToXlsx(report: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = `${EVENT.name} ${EVENT.short} Portal`;
  wb.company = EVENT.organiser;
  wb.title = report.title;
  wb.created = report.generatedAt;
  const logoId = wb.addImage({ buffer: (await logo()) as unknown as ExcelJS.Buffer, extension: "png" });
  for (const t of report.tables) addSheet(wb, report, t, logoId);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
