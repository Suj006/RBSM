import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { matchChecks } from "@/lib/matchmaking";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";

const TONE = { high: "red", medium: "amber", low: "slate" } as const;

/** Mappings that look incorrect — for the Directorate's reference; they never block publishing. */
export async function MatchChecks({ base }: { base: string }) {
  const issues = await matchChecks();
  const n = (s: string) => issues.filter((i) => i.severity === s).length;
  return (
    <>
      <PageHeader eyebrow="Matchmaking" title="Mapping checks"
        subtitle="Pairs and buyers that may need attention before publishing. These are shown only to the Directorate, for reference — they do not stop publishing." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="High — likely incorrect" value={n("high")} accent="red" hint="No common sector, or buyer / seller no longer approved" />
        <StatCard label="Medium — incomplete" value={n("medium")} accent="yellow" hint="Buyer below target, seller over the limit" />
        <StatCard label="Low — worth a look" value={n("low")} accent="slate" hint="Same sector but no named product, above target" />
      </div>
      <Card className="overflow-hidden">
        {issues.length ? (
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">Severity</th><th className="px-3 py-2.5 text-left">Check</th><th className="px-3 py-2.5 text-left">Buyer</th><th className="px-3 py-2.5 text-left">Seller</th><th className="px-4 py-2.5 text-left">Detail</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((i, k) => (
                  <tr key={k} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-2.5"><Badge tone={TONE[i.severity]}>{i.severity[0].toUpperCase() + i.severity.slice(1)}</Badge></td>
                    <td className="px-3 py-2.5 font-medium text-ink">{i.kind}</td>
                    <td className="px-3 py-2.5">{i.buyerId ? <Link href={`${base}/buyers/${i.buyerId}`} className="text-ink hover:text-brand-700">{i.buyer}</Link> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-slate-700">{i.seller ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-2.5 text-slate-600">{i.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<ShieldCheck className="size-5" />} title="No issues found">Every mapped pair shares a sector and every buyer is at target.</EmptyState>}
      </Card>
    </>
  );
}
