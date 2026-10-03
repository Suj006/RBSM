import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { EVENT } from "@/lib/config";
import { ITEM_META, SELLER_META, STATUS_META } from "@/lib/status";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { BuyerStatus, ItemStatus, SellerStatus } from "@/generated/prisma/enums";
import { C, TONE } from "./theme";
import type { Column, Report, Row, Table } from "./types";

// Never hyphenate words ("Per-son", "Ap-proved"); long codes are broken by softBreak below.
Font.registerHyphenationCallback((word) => [word]);

/**
 * Long tokens without spaces (RBSM-Buyer-2026001, e-mail addresses) cannot wrap
 * on their own and would spill into the next column. Break them onto a new line
 * after "-", "@", "." or "/" when they are wider than the column.
 */
function softBreak(value: string, maxChars: number) {
  if (maxChars < 4) return value;
  return value
    .split("\n")
    .map((line) => line.split(" ").map((tok) => {
      if (tok.length <= maxChars) return tok;
      // Break after "-", "@", "." or "/"; a part still too long (a long place name) is cut to fit.
      // (The width estimate is an average, so allow some slack before cutting a word.)
      const hard = Math.ceil(maxChars * 1.25);
      const parts = tok.split(/(?<=[-@./])/).flatMap((p) => (p.length > hard ? p.match(new RegExp(`.{1,${hard}}`, "g")) ?? [p] : [p]));
      const out: string[] = [];
      let cur = "";
      for (const p of parts) {
        if (cur && (cur + p).length > maxChars) { out.push(cur); cur = p; } else cur += p;
      }
      if (cur) out.push(cur);
      return out.join("\n");
    }).join(" "))
    .join("\n");
}

const hex = (h: string) => `#${h}`;

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8.5, color: hex(C.ink), paddingTop: 74, paddingBottom: 44, paddingHorizontal: 30 },
  header: { position: "absolute", top: 18, left: 30, right: 30 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { height: 30, width: 88 },
  headerRight: { alignItems: "flex-end" },
  eventLine: { fontSize: 7, fontFamily: "Helvetica-Bold", color: hex(C.brand), letterSpacing: 0.8 },
  headerTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 },
  ribbon: { flexDirection: "row", height: 3, marginTop: 8 },
  footer: {
    position: "absolute", bottom: 18, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 0.5, borderTopColor: hex(C.border), paddingTop: 6, fontSize: 7, color: hex(C.muted),
  },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  description: { fontSize: 9, color: hex(C.muted), marginBottom: 6 },
  meta: { fontSize: 7.5, color: hex(C.muted), marginBottom: 10 },
  kpis: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpi: { flex: 1, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 9, borderLeftWidth: 3 },
  kpiLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 3, color: hex(C.ink) },
  section: { marginBottom: 14 },
  sectionHeading: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: hex(C.brandDark), marginBottom: 5 },
  thead: { flexDirection: "row", backgroundColor: hex(C.brand), borderBottomWidth: 1.2, borderBottomColor: hex(C.brandDark) },
  th: { color: hex(C.white), fontFamily: "Helvetica-Bold", fontSize: 7.5, paddingVertical: 5, paddingHorizontal: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: hex(C.border) },
  td: { paddingVertical: 4, paddingHorizontal: 4, fontSize: 7.8, lineHeight: 1.3 },
  totals: { flexDirection: "row", backgroundColor: hex(C.brandLight), borderTopWidth: 1, borderTopColor: hex(C.brand) },
  pill: { borderRadius: 3, paddingVertical: 1.5, paddingHorizontal: 4, fontFamily: "Helvetica-Bold", fontSize: 7 },
  empty: { padding: 12, textAlign: "center", color: hex(C.muted), fontFamily: "Helvetica-Oblique", borderBottomWidth: 0.5, borderBottomColor: hex(C.border) },
  note: { fontSize: 7, color: hex(C.muted), fontFamily: "Helvetica-Oblique", marginTop: 4 },
});

const KPI_TONE: Record<string, string> = { green: "green", red: "red", yellow: "amber", blue: "blue", violet: "violet", slate: "slate" };
const BAR: Record<string, string> = { green: C.green, red: C.red, yellow: C.yellow, blue: C.blue, violet: "7C3AED", slate: "94A3B8" };

function statusOf(col: Column, v: Row[string]) {
  if (col.kind === "buyerStatus" && typeof v === "string" && v in STATUS_META) return STATUS_META[v as BuyerStatus];
  if (col.kind === "itemStatus" && typeof v === "string" && v in ITEM_META) return ITEM_META[v as ItemStatus];
  if (col.kind === "sellerStatus" && typeof v === "string" && v in SELLER_META) return SELLER_META[v as SellerStatus];
  return null;
}

function text(col: Column, v: Row[string]): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v instanceof Date) return col.kind === "datetime" ? fmtDateTime(v) : fmtDate(v);
  if (col.kind === "percent" && typeof v === "number") return `${(v * 100).toFixed(1)}%`;
  return String(v);
}

function Cell({ col, v, total, contentWidth, bold }: { col: Column; v: Row[string]; total: number; contentWidth: number; bold?: boolean }) {
  const st = statusOf(col, v);
  const width = `${(col.width / total) * 100}%`;
  if (st) {
    const t = TONE[st.tone];
    return (
      <View style={[s.td, { width }]}>
        <Text style={[s.pill, { backgroundColor: hex(t.fill), color: hex(t.text) }]}>{st.label}</Text>
      </View>
    );
  }
  // Approximate characters per line: Helvetica averages ~0.55 em per character.
  const maxChars = Math.floor(((col.width / total) * contentWidth - 8) / (7.8 * 0.55));
  // Totals rows leave empty cells blank rather than showing a dash.
  const value = bold && (v === "" || v === null || v === undefined) ? "" : softBreak(text(col, v), maxChars);
  return (
    <Text style={[s.td, { width, textAlign: col.align ?? "left" }, col.kind === "mono" ? { fontFamily: "Helvetica-Bold" } : {},
      bold ? { fontFamily: "Helvetica-Bold" } : {}, value === "—" ? { color: "#94A3B8" } : {}]}>
      {value}
    </Text>
  );
}

function TableView({ table: full, repeatHeader, contentWidth }: { table: Table; repeatHeader: boolean; contentWidth: number }) {
  const table = { ...full, columns: full.columns.filter((c) => !c.excelOnly) };
  const total = table.columns.reduce((n, c) => n + c.width, 0);
  const head = (
    <>
      {table.heading && <Text style={s.sectionHeading}>{table.heading}</Text>}
      {/* In single-table reports the column headings repeat on every page. */}
      <View style={s.thead} fixed={repeatHeader}>
        {table.columns.map((c) => (
          <Text key={c.key} style={[s.th, { width: `${(c.width / total) * 100}%`, textAlign: c.align ?? "left" }]}>{c.header}</Text>
        ))}
      </View>
    </>
  );
  const row = (r: Row, i: number) => (
    <View key={i} style={[s.tr, i % 2 ? { backgroundColor: hex(C.zebra) } : {}]} wrap={false}>
      {table.columns.map((c) => <Cell key={c.key} col={c} v={r[c.key]} total={total} contentWidth={contentWidth} />)}
    </View>
  );
  const KEEP = 2; // heading + column headings never sit alone at the foot of a page
  return (
    <View style={s.section}>
      {repeatHeader ? head : <View wrap={false}>{head}{table.rows.slice(0, KEEP).map(row)}</View>}
      {(repeatHeader ? table.rows : table.rows.slice(KEEP)).map((r, i) => row(r, repeatHeader ? i : i + KEEP))}
      {!table.rows.length && <Text style={s.empty}>No records match the selected filters.</Text>}
      {table.totals && (
        <View style={s.totals} wrap={false}>
          {table.columns.map((c) => <Cell key={c.key} col={c} v={table.totals![c.key] ?? ""} total={total} contentWidth={contentWidth} bold />)}
        </View>
      )}
    </View>
  );
}

function ReportDocument({ report, logo }: { report: Report; logo: Buffer }) {
  const stamp = fmtDateTime(report.generatedAt);
  return (
    <Document title={report.title} author={EVENT.organiser} creator={`${EVENT.name} ${EVENT.short} Portal`} producer={`${EVENT.name} ${EVENT.short} Portal`}>
      <Page size="A4" orientation={report.orientation} style={s.page} wrap>
        <View style={s.header} fixed>
          <View style={s.headerRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={{ data: logo, format: "png" }} style={s.logo} />
            <View style={s.headerRight}>
              <Text style={s.eventLine}>{`${EVENT.name} · ${EVENT.programme}`.toUpperCase()}</Text>
              <Text style={s.headerTitle}>{report.title}</Text>
            </View>
          </View>
          <View style={s.ribbon}>
            {[C.red, C.yellow, C.green, C.blue].map((c) => <View key={c} style={{ flex: 1, backgroundColor: hex(c) }} />)}
          </View>
        </View>

        <Text style={s.title}>{report.title}</Text>
        <Text style={s.description}>{report.description}</Text>
        <Text style={s.meta}>
          {`Generated on ${stamp} by ${report.generatedBy}` +
            (report.id.endsWith("-profile") ? "" : `   |   ${report.filters.length ? `Filters: ${report.filters.join("; ")}` : "Filters: none (all records)"}`)}
        </Text>

        {report.kpis.length > 0 && (
          <View style={s.kpis}>
            {report.kpis.map((k) => {
              const t = TONE[KPI_TONE[k.tone ?? "slate"]];
              return (
                <View key={k.label} style={[s.kpi, { backgroundColor: hex(t.fill), borderLeftColor: hex(BAR[k.tone ?? "slate"]) }]}>
                  <Text style={[s.kpiLabel, { color: hex(t.text) }]}>{k.label.toUpperCase()}</Text>
                  <Text style={s.kpiValue}>{String(k.value)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {report.tables.map((t) => <TableView key={t.name} table={t} repeatHeader={report.tables.length === 1} contentWidth={(report.orientation === "landscape" ? 842 : 595) - 60} />)}
        <Text style={s.note}>System-generated report from the {EVENT.name} {EVENT.short} portal. Figures reflect the position at the time of generation.</Text>

        <View style={s.footer} fixed>
          <Text>{`${EVENT.name} ${EVENT.short} · ${EVENT.organiser}`}</Text>
          <Text>For official use</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

let logoCache: Buffer | null = null;

export async function reportToPdf(report: Report): Promise<Buffer> {
  logoCache ??= await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "tradex-logo.png"));
  return renderToBuffer(<ReportDocument report={report} logo={logoCache} />);
}
