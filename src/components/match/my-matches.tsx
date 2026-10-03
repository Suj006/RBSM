import Link from "next/link";
import { CalendarClock, Handshake } from "lucide-react";
import { getMatchState, publishedMatches } from "@/lib/matchmaking";
import { fmtDateTime, parseCerts } from "@/lib/format";
import { Badge, Card, CardHeader } from "@/components/ui";

/** A seller's published buyer meetings (nothing is shown before the Directorate publishes). */
export async function SellerMeetings({ sellerId }: { sellerId: string }) {
  const [state, rows] = await Promise.all([getMatchState(), publishedMatches({ sellerId })]);
  return (
    <Card id="meetings" className="scroll-mt-24">
      <CardHeader title={`Your buyer meetings${state.version ? ` (${rows.length})` : ""}`} icon={<CalendarClock className="size-4" />}
        subtitle={state.version ? `Published ${fmtDateTime(state.publishedAt)}${state.locked ? " · final" : ""}` : undefined} />
      {!state.version ? (
        <p className="p-6 text-sm text-slate-500">Matchmaking is in progress. Your matched international buyers will be listed here once the Directorate publishes them.</p>
      ) : rows.length ? (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-bold text-ink">{r.buyer.name}</div>
                <span className="text-sm text-slate-500">{r.buyer.country}</span>
              </div>
              {r.buyer.pocName && <div className="text-xs text-slate-500">Contact: {r.buyer.pocName}{r.buyer.pocDesignation ? `, ${r.buyer.pocDesignation}` : ""}</div>}
              <ul className="mt-2 space-y-1.5">
                {r.buyer.requirement?.items.map((i) => (
                  <li key={i.sector.name} className="text-sm">
                    <span className="font-semibold text-ink">{i.sector.name}:</span> <span className="text-slate-700">{i.products}</span>
                    {(i.specifications || i.quantity) && <div className="text-xs text-slate-500">{[i.specifications, i.quantity && `Volume: ${i.quantity}`].filter(Boolean).join(" · ")}</div>}
                    {parseCerts(i.certifications).length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{parseCerts(i.certifications).map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : <p className="p-6 text-sm text-slate-500">No buyer has been matched with you in the published list.</p>}
    </Card>
  );
}

/** A buyer's published sellers. */
export async function BuyerMatches({ buyerId, full }: { buyerId: string; full?: boolean }) {
  const [state, rows] = await Promise.all([getMatchState(), publishedMatches({ buyerId })]);
  return (
    <Card>
      <CardHeader title={`Your matched Kerala sellers${state.version ? ` (${rows.length})` : ""}`} icon={<Handshake className="size-4" />}
        subtitle={state.version ? `Published ${fmtDateTime(state.publishedAt)}${state.locked ? " · final" : ""}` : undefined}
        action={!full && rows.length ? <Link href="/buyer/matches" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link> : undefined} />
      {!state.version ? (
        <p className="p-6 text-sm text-slate-500">Matchmaking is in progress. Your matched Kerala MSME sellers will be listed here once the Directorate publishes them.</p>
      ) : rows.length ? (
        <ul className="divide-y divide-slate-100">
          {(full ? rows : rows.slice(0, 5)).map((r) => (
            <li key={r.id} className="px-5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold text-ink"><span className="mr-2 text-slate-400 tabular-nums">{r.slot}.</span>{r.seller.name}</div>
                <span className="text-xs text-slate-500">{r.seller.district}, Kerala{r.seller.exportExperience ? " · export experience" : ""}</span>
              </div>
              <div className="mt-1 text-sm text-slate-600">{r.seller.products.map((p) => `${p.sector.name}: ${p.products}`).join(" · ")}</div>
              {full && <div className="text-xs text-slate-500">Promoter: {r.seller.contactName}</div>}
            </li>
          ))}
        </ul>
      ) : <p className="p-6 text-sm text-slate-500">No seller has been matched with you in the published list.</p>}
    </Card>
  );
}
