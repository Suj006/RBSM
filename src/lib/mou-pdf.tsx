import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { EVENT } from "@/lib/config";
import { C } from "@/lib/reports/theme";
import type { MouDoc } from "@/lib/mou-doc";

Font.registerHyphenationCallback((word) => [word]);
const hex = (h: string) => `#${h}`;
const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: hex(C.ink), paddingTop: 30, paddingBottom: 40, paddingHorizontal: 46, lineHeight: 1.3 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { height: 34, width: 100 },
  no: { alignItems: "flex-end" },
  noLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: hex(C.muted), letterSpacing: 0.8 },
  noValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  ribbon: { flexDirection: "row", height: 3, marginTop: 8, marginBottom: 12 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "center", letterSpacing: 1, lineHeight: 1.2 },
  subtitle: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 6, marginBottom: 10, color: hex(C.brandDark) },
  intro: { textAlign: "justify", marginBottom: 8 },
  parties: { flexDirection: "row", gap: 10, marginBottom: 6 },
  party: { flex: 1, borderWidth: 0.7, borderColor: hex(C.border), borderRadius: 4, padding: 7 },
  role: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: hex(C.brand), letterSpacing: 0.6 },
  partyName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2, marginBottom: 2 },
  small: { fontSize: 8.5, color: hex("334155") },
  h: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 5, marginBottom: 1 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: hex(C.border), paddingVertical: 2 },
  label: { width: "38%", color: hex(C.muted) },
  value: { width: "62%", fontFamily: "Helvetica-Bold" },
  verify: { marginTop: 10, padding: 7, backgroundColor: hex(C.brandLight), borderRadius: 4 },
  sigs: { flexDirection: "row", gap: 30, marginTop: 26 },
  sig: { flex: 1, borderTopWidth: 0.8, borderTopColor: hex(C.ink), paddingTop: 4 },
  draft: { position: "absolute", top: 380, left: -40, width: 680, textAlign: "center", fontSize: 58, color: "#DC2626", opacity: 0.12, transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 22, left: 50, right: 50, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: hex(C.muted), borderTopWidth: 0.5, borderTopColor: hex(C.border), paddingTop: 5 },
});

function MouPdf({ d, logo }: { d: MouDoc; logo: Buffer }) {
  return (
    <Document title={`MoU ${d.mouNo}`} author={EVENT.organiser} creator={`${EVENT.name} ${EVENT.short} Portal`}>
      <Page size="A4" style={s.page}>
        {d.draft && <Text style={s.draft} fixed>NOT YET APPROVED</Text>}
        <View style={s.top}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={{ data: logo, format: "png" }} style={s.logo} />
          <View style={s.no}><Text style={s.noLabel}>MOU NO.</Text><Text style={s.noValue}>{d.mouNo}</Text><Text style={s.small}>{`${d.place} · ${d.date}`}</Text></View>
        </View>
        <View style={s.ribbon}>{[C.red, C.yellow, C.green, C.blue].map((c) => <View key={c} style={{ flex: 1, backgroundColor: hex(c) }} />)}</View>
        <Text style={s.title}>MEMORANDUM OF UNDERSTANDING</Text>
        <Text style={s.subtitle}>Intention for Placing Orders</Text>
        <Text style={s.intro}>{d.intro}</Text>
        <Text style={{ marginBottom: 4 }}>This MoU is made between:</Text>
        <View style={s.parties}>
          {d.parties.map((p) => (
            <View key={p.role} style={s.party}>
              <Text style={s.role}>{p.role.toUpperCase()}</Text>
              <Text style={s.partyName}>{p.name}</Text>
              {p.lines.map((l) => <Text key={l} style={s.small}>{l}</Text>)}
            </View>
          ))}
        </View>
        {d.sections.map((sec) => (
          <View key={sec.heading} wrap={false}>
            <Text style={s.h}>{sec.heading}</Text>
            {sec.text?.map((t) => <Text key={t} style={{ textAlign: "justify" }}>{t}</Text>)}
            {sec.rows?.map(([k, v]) => <View key={k} style={s.row}><Text style={s.label}>{k}</Text><Text style={s.value}>{v}</Text></View>)}
          </View>
        ))}
        <View style={s.verify} wrap={false}>
          {d.verification.map(([k, v]) => <View key={k} style={{ flexDirection: "row" }}><Text style={[s.label, { fontSize: 9 }]}>{k}</Text><Text style={[s.value, { fontSize: 9 }]}>{v}</Text></View>)}
        </View>
        <View style={s.sigs} wrap={false}>
          {d.signatures.map((g) => (
            <View key={g.party} style={s.sig}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{g.party}</Text>
              <Text style={s.small}>{g.name}</Text>
              <Text style={s.small}>{`Name: ${g.contact}`}</Text>
              <Text style={s.small}>Signature and date</Text>
            </View>
          ))}
        </View>
        <View style={s.footer} fixed>
          <Text>{`${EVENT.name} ${EVENT.short} · ${EVENT.organiser}`}</Text>
          <Text>{d.mouNo}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

let logo: Buffer | null = null;
export async function mouToPdf(d: MouDoc) {
  logo ??= await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "tradex-logo.png"));
  // The PDF's built-in fonts have no rupee sign: write "Rs." instead.
  const plain = JSON.parse(JSON.stringify(d).replace(/₹\s?/g, "Rs. ")) as MouDoc;
  return renderToBuffer(<MouPdf d={plain} logo={logo} />);
}
