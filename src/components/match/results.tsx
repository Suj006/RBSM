import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { coverage } from "@/lib/matchmaking";
import { Badge, Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { cn } from "@/lib/cn";

const STATUS_TONE = { "No buyer requirement": "blue", "No approved seller": "red", "Short of sellers": "amber", Covered: "green" } as const;

/** After publishing: the numbers, who is left out, and where to act — find buyers, mobilise sellers, adjust the mapping. */
export async function MatchResults({ base, staffBase, which }: { base: string; staffBase: string; which: "published" | "draft" }) {
  const c = await coverage(which);
  const label = which === "published" ? (c.state.version ? `published version ${c.state.version}` : "published mapping (not published yet)") : "working list";
  const noBuyerSectors = c.sectorRows.filter((r) => r.status === "No buyer requirement");
  const noSellerSectors = c.sectorRows.filter((r) => r.status === "No approved seller");
  const shortSectors = c.sectorRows.filter((r) => r.status === "Short of sellers");
  const gapsNoSupply = c.productGaps.filter((p) => !p.availableSellers);
  const gapsAvailable = c.productGaps.filter((p) => p.availableSellers);

  const actions = [
    c.buyersBelow.length && `${c.buyersBelow.length} buyer${c.buyersBelow.length > 1 ? "s are" : " is"} below ${c.target} sellers — ${c.sellersNeeded} more seller slot${c.sellersNeeded > 1 ? "s" : ""} needed. Add sellers on the mapping board or mobilise more MSMEs in their sectors.`,
    c.sellersWithout.length && `${c.sellersWithout.length} approved seller${c.sellersWithout.length > 1 ? "s have" : " has"} no buyer${c.sellersWithout.filter((s) => s.gavePreferences).length ? ` (${c.sellersWithout.filter((s) => s.gavePreferences).length} of them gave preferences)` : ""} — consider them for buyers below target, or look for new buyers in their sectors.`,
    noBuyerSectors.length && `No buyer requirement yet in ${noBuyerSectors.length} sector${noBuyerSectors.length > 1 ? "s" : ""} with approved sellers (${noBuyerSectors.slice(0, 4).map((r) => r.name).join(", ")}${noBuyerSectors.length > 4 ? "…" : ""}) — focus buyer outreach here.`,
    noSellerSectors.length && `No approved seller in ${noSellerSectors.length} sector${noSellerSectors.length > 1 ? "s" : ""} that buyers need (${noSellerSectors.map((r) => r.name).join(", ")}) — ask district centres to mobilise MSMEs.`,
    gapsNoSupply.length && `${gapsNoSupply.length} requested product${gapsNoSupply.length > 1 ? "s have" : " has"} no approved seller at all — a lead for seller mobilisation.`,
    gapsAvailable.length && `${gapsAvailable.length} requested product${gapsAvailable.length > 1 ? "s are" : " is"} offered by approved sellers who are not mapped to that buyer — consider adding them.`,
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader eyebrow="Matchmaking" title="Results & gaps"
        subtitle={`Position of the ${label}: who is matched, who is left out, and where to act next.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-white p-0.5 text-sm ring-1 ring-slate-200">
              <Link href={`${base}/results`} className={cn("rounded-md px-3 py-1.5 font-semibold", which === "published" ? "bg-ink text-white" : "text-slate-600 hover:text-ink")}>Published</Link>
              <Link href={`${base}/results?v=draft`} className={cn("rounded-md px-3 py-1.5 font-semibold", which === "draft" ? "bg-ink text-white" : "text-slate-600 hover:text-ink")}>Working list</Link>
            </div>
            <DownloadButtons href={`/api/reports/match-coverage${which === "draft" ? "?v=draft" : ""}`} label="Gaps report" compact />
          </div>
        } />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Buyer–seller pairs" value={c.pairs} accent="blue" hint={`${c.source.preference} preference · ${c.source.system} system · ${c.source.manual} manual`} />
        <StatCard label={`Buyers with ${c.target}+ sellers`} value={`${c.buyersAtTarget} / ${c.buyers}`} accent="green" hint={`${c.buyersBelow.length} below target · ${c.buyers - c.buyersMatched} with none`} />
        <StatCard label="Sellers with at least one buyer" value={`${c.sellersMatched} / ${c.sellers}`} accent="violet" hint={`${c.sellersWithout.length} approved seller${c.sellersWithout.length === 1 ? "" : "s"} without a buyer`} />
        <StatCard label="Average sellers per buyer" value={c.buyers ? (c.pairs / c.buyers).toFixed(1) : "—"} accent="yellow" hint={`Target ${c.target}`} />
      </div>

      {actions.length > 0 && (
        <Card className="mt-6 border-l-4 border-l-tx-yellow">
          <CardHeader title="Where to act" icon={<Lightbulb className="size-4" />} />
          <ul className="list-disc space-y-1.5 py-4 pl-10 pr-6 text-sm text-slate-700">{actions.map((a) => <li key={a}>{a}</li>)}</ul>
        </Card>
      )}

      <div className="mt-6 grid items-start gap-6 2xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title={`Buyers below ${c.target} sellers (${c.buyersBelow.length})`} subtitle="Fewest sellers first" />
          <div className="table-scroll relative max-h-[440px] overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">Buyer</th><th className="px-3 py-2.5 text-left">Sectors</th><th className="px-3 py-2.5 text-right">Sellers</th><th className="px-4 py-2.5 text-right">Short by</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {c.buyersBelow.map((b) => (
                  <tr key={b.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-2"><Link href={`${base}/buyers/${b.id}`} className="font-medium text-ink hover:text-brand-700">{b.name}</Link><div className="text-xs text-slate-500">{b.country}</div></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{b.sectors.join(", ")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.n}</td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums text-tx-red">{b.shortfall}</td>
                  </tr>
                ))}
                {!c.buyersBelow.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Every approved buyer has {c.target} or more sellers.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={`Approved sellers without a buyer (${c.sellersWithout.length})`} />
          <div className="table-scroll relative max-h-[440px] overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">Seller</th><th className="px-3 py-2.5 text-left">Sectors</th><th className="px-4 py-2.5 text-left">Preferences</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {c.sellersWithout.map((s) => (
                  <tr key={s.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-2"><Link href={`${staffBase}/sellers/${s.id}`} className="font-medium text-ink hover:text-brand-700">{s.name}</Link><div className="text-xs text-slate-500">{s.district}</div></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.sectors.join(", ")}</td>
                    <td className="px-4 py-2">{s.gavePreferences ? <Badge tone="violet">Gave preferences</Badge> : <span className="text-xs text-slate-400">—</span>}</td>
                  </tr>
                ))}
                {!c.sellersWithout.length && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">Every approved seller has at least one buyer.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Sector coverage" subtitle={`Approved buyers and sellers per sector, sellers needed (buyers × ${c.target}) and how many are used in the mapping`} />
        <div className="table-scroll relative overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 text-left">Sector</th><th className="px-3 py-2.5 text-right">Approved buyers</th><th className="px-3 py-2.5 text-right">Sellers needed</th>
                <th className="px-3 py-2.5 text-right">Approved sellers</th><th className="px-3 py-2.5 text-right">Sellers mapped</th><th className="px-3 py-2.5 text-right">Not mapped</th><th className="px-4 py-2.5 text-left">Position</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.sectorRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-ink">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.buyers || <span className="text-tx-red">0</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.needed || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.sellers || <span className="text-tx-red">0</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.matchedSellers}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.unmatchedSellers}</td>
                  <td className="px-4 py-2"><Badge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE]}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid items-start gap-6 2xl:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title={`Requested products not covered by the matched sellers (${c.productGaps.length})`}
            subtitle="Products a buyer asked for that none of the sellers mapped to that buyer offers" />
          <div className="table-scroll relative max-h-[480px] overflow-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">Product</th><th className="px-3 py-2.5 text-left">Buyer</th><th className="px-4 py-2.5 text-left">Approved sellers offering it</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {c.productGaps.map((p, i) => (
                  <tr key={i} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-2"><div className="font-medium text-ink">{p.product}</div><div className="text-xs text-slate-500">{p.sector}</div></td>
                    <td className="px-3 py-2"><Link href={`${base}/buyers/${p.buyerId}`} className="text-ink hover:text-brand-700">{p.buyer}</Link></td>
                    <td className="px-4 py-2">{p.availableSellers ? <Badge tone="amber">{p.availableSellers} available — not mapped</Badge> : <Badge tone="red">None — mobilise sellers</Badge>}</td>
                  </tr>
                ))}
                {!c.productGaps.length && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">Every requested product is offered by at least one matched seller.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="District position" subtitle="Approved sellers and how many have buyers" />
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">District</th><th className="px-3 py-2.5 text-right">Sellers</th><th className="px-3 py-2.5 text-right">With buyers</th><th className="px-3 py-2.5 text-right">Without</th><th className="px-4 py-2.5 text-right">Meetings</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {c.districtRows.map((r) => (
                  <tr key={r.district} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-ink">{r.district}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.sellers}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.matched}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", r.unmatched ? "font-semibold text-tx-red" : "text-slate-400")}>{r.unmatched}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.meetings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
