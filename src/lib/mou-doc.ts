import "server-only";
import { EVENT } from "@/lib/config";
import { fmtDay, fmtTime, getEventConfig } from "@/lib/event";
import { fmtDate } from "@/lib/format";
import { fmtInr, fmtMonth, fmtUsd, getMouRate, toMoney, type FullMou } from "@/lib/mou";

export type MouDoc = {
  mouNo: string; draft: boolean; date: string; place: string;
  intro: string;
  parties: { role: string; name: string; lines: string[] }[];
  sections: { heading: string; rows?: [string, string][]; text?: string[] }[];
  verification: [string, string][];
  signatures: { party: string; name: string; contact: string }[];
};

/** The MoU's text — the same on screen and in the PDF. Buyer, seller, meeting and event details are filled in automatically. */
export async function mouDocument(m: FullMou): Promise<MouDoc> {
  const [cfg, rate] = await Promise.all([getEventConfig(), getMouRate()]);
  const days = cfg.days.map((d) => fmtDay(d.date));
  const when = days.length ? (days.length > 1 ? `${days[0]} to ${days.at(-1)}` : days[0]) : "the event days";
  const where = cfg.venue || EVENT.hostCity;
  const money = toMoney(m, rate);
  const value = !money ? "To be determined"
    : m.currency === "USD" ? `${fmtUsd(money.usd)} (approx. ${fmtInr(money.inr)})` : `${fmtInr(money.inr)} (approx. ${fmtUsd(money.usd)})`;
  const dayNo = m.meeting ? cfg.days.find((d) => d.date === m.meeting!.day)?.n : undefined;
  return {
    mouNo: m.mouNo,
    draft: m.status !== "APPROVED",
    date: fmtDate(m.approvedAt ?? m.submittedAt),
    place: EVENT.hostCity,
    intro: `This Memorandum of Understanding ("MoU") is part of ${EVENT.name} ${EVENT.programme}, the International Buyer Seller Meet organised by the ${EVENT.organiser}, Government of Kerala, with the ${EVENT.partner}, at ${where} under the ${EVENT.scheme} on ${when}.`,
    parties: [
      { role: "Party A — Seller", name: m.seller.name, lines: [
        `Seller ID: ${m.seller.approvedNo ?? m.seller.regNo}`, `${m.seller.taluk ? `${m.seller.taluk}, ` : ""}${m.seller.district} District, Kerala, India`,
        `Udyam: ${m.seller.udyamNo}${m.seller.iecNo ? ` · IEC: ${m.seller.iecNo}` : ""}`, `${m.seller.contactName} · ${m.seller.contactMobile} · ${m.seller.contactEmail}`] },
      { role: "Party B — Buyer", name: m.buyer.name, lines: [
        `Buyer ID: ${m.buyer.approvedNo ?? m.buyer.regNo}`, m.buyer.country,
        `${m.buyer.pocName ?? ""}${m.buyer.pocDesignation ? `, ${m.buyer.pocDesignation}` : ""}`, `${m.buyer.pocEmail ?? ""}${m.buyer.pocMobile ? ` · ${m.buyer.pocMobile}` : ""}`].filter(Boolean) },
    ],
    sections: [
      { heading: "1. Purpose", text: ["The purpose of this MoU is to establish the general business relation under which Party A intends to sell and Party B intends to buy the goods described below."] },
      { heading: "2. Products and Quality", rows: [
        ["Description of goods", m.goods], ["Sector", m.sector?.name ?? "—"], ["Approximate value", value],
        ["Approximate month of placing the order", fmtMonth(m.orderMonth)]] },
      { heading: "3. Quality, specifications and certification", text: ["The goods shall conform to the specifications, quality standards, packaging and certifications agreed between the parties in the purchase order."] },
      { heading: "4. Commercial terms", text: ["Prices, quantities, payment terms, delivery schedule and Incoterms will be settled between the parties in their purchase order or contract."] },
      { heading: "5. Nature of this MoU", text: ["This MoU records the intention of the parties to do business. It is not a contract of sale and creates no legal or financial obligation on either party, on the Directorate of Industries & Commerce or on FIEO."] },
      { heading: "6. Validity", text: ["This MoU is valid for twelve months from the date of approval, unless the parties extend it in writing."] },
      { heading: "7. Facilitation and follow-up", text: [`The meeting was facilitated by the ${EVENT.organiser}, Kerala and FIEO, who may follow up with both parties on the progress of the order.`] },
      ...(m.meeting ? [{ heading: "Meeting reference", rows: [
        ["B2B meeting", `${dayNo ? `Day ${dayNo} · ` : ""}${fmtDay(m.meeting.day)}, ${fmtTime(m.meeting.startAt)}`] as [string, string],
        ["Pavilion · ticket", `${m.meeting.pavilionNo ?? "–"} · ${m.meeting.ticketNo}`] as [string, string]] }] : []),
    ],
    verification: [
      ["Submitted by the buyer", fmtDate(m.submittedAt)],
      ["Verified by the nodal officer", m.nodalVerifiedAt ? `${m.nodalVerifiedBy?.displayName ?? ""}, ${fmtDate(m.nodalVerifiedAt)}` : "Pending"],
      ["Approved by FIEO", m.fieoApprovedAt ? `${m.fieoApprovedBy?.displayName ?? ""}, ${fmtDate(m.fieoApprovedAt)}` : "Pending"],
    ],
    signatures: [
      { party: "For Party A (Seller)", name: m.seller.name, contact: m.seller.contactName },
      { party: "For Party B (Buyer)", name: m.buyer.name, contact: m.buyer.pocName ?? "" },
    ],
  };
}
