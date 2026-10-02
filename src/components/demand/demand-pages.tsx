import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Package } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { sectorDemandDetail, sectorDemandSummary } from "@/lib/demand";
import { ITEM_META } from "@/lib/status";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";

export async function DemandSummaryPage({ user, base }: { user: User; base: string }) {
  const rows = await sectorDemandSummary(user);
  const buyers = rows.reduce((a, r) => a + r.buyers, 0);
  return (
    <>
      <PageHeader eyebrow="Matchmaking" title="Sector demand"
        subtitle="For every sector: how many buyers need it, which products they want, and how many approved sellers offer it."
        actions={<DownloadButtons href="/api/reports/sector-demand" label="Sector demand report" compact />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sectors with buyer demand" value={rows.filter((r) => r.buyers).length} accent="blue" />
        <StatCard label="Buyer-sector requirements" value={buyers} accent="violet" hint="Submitted requirements (drafts excluded)" />
        <StatCard label="Distinct products requested" value={rows.reduce((a, r) => a + r.products.length, 0)} accent="yellow" />
        <StatCard label="Sectors without approved sellers" value={rows.filter((r) => r.buyers && !r.sellers).length} accent="red" hint="Need seller mobilisation" />
      </div>
      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-3 py-3 text-right">Buyers</th>
                  <th className="px-3 py-3 text-right">Approved</th>
                  <th className="px-4 py-3">Most requested products</th>
                  <th className="px-3 py-3 text-right">Approved sellers</th>
                  <th className="px-3 py-3 text-right">Sellers / buyer</th>
                  <th className="px-3 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="group hover:bg-brand-50/40">
                    <td className="px-4 py-3 align-top"><Link href={`${base}/${r.id}`} className="font-semibold text-ink hover:text-brand-700">{r.name}</Link></td>
                    <td className="px-3 py-3 text-right align-top font-semibold tabular-nums">{r.buyers}</td>
                    <td className="px-3 py-3 text-right align-top tabular-nums text-slate-600">{r.approvedReqs}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {r.products.slice(0, 5).map((p) => (
                          <span key={p.product} className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                            {p.product}<span className="rounded bg-ink px-1 text-[10px] font-bold text-white">{p.buyers}</span>
                          </span>
                        ))}
                        {r.products.length > 5 && <span className="text-xs text-slate-500">+{r.products.length - 5} more</span>}
                        {!r.products.length && <span className="text-xs text-slate-400">No buyer demand yet</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right align-top tabular-nums">{r.sellers || <span className="font-semibold text-tx-red">0</span>}</td>
                    <td className="px-3 py-3 text-right align-top tabular-nums text-slate-600">{r.buyers ? (r.sellers / r.buyers).toFixed(1) : "—"}</td>
                    <td className="px-3 py-3 text-right align-top">
                      <Link href={`${base}/${r.id}`} aria-label={`Open ${r.name}`} className="inline-grid size-8 place-items-center rounded-lg text-slate-400 group-hover:bg-white group-hover:text-brand-700"><ChevronRight className="size-4" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<Package className="size-5" />} title="No sector demand yet">Buyer requirements appear here once submitted.</EmptyState>}
      </Card>
    </>
  );
}

export async function DemandDetailPage({ user, base, sectorId, buyerBase, sellerBase }: {
  user: User; base: string; sectorId: string; buyerBase: string; sellerBase: string;
}) {
  const d = await sectorDemandDetail(user, sectorId);
  if (!d) notFound();
  return (
    <>
      <PageHeader back={{ href: base, label: "Back to all sectors", from: [{ href: base.slice(0, base.lastIndexOf("/")), label: "Back to dashboard" }] }} eyebrow="Sector demand" title={d.sector.name}
        subtitle={`${d.buyers.length} buyer requirement${d.buyers.length === 1 ? "" : "s"} · ${d.products.length} distinct products requested · ${d.sellers.length} approved seller${d.sellers.length === 1 ? "" : "s"}`}
        actions={<DownloadButtons href={`/api/reports/sector-demand?sector=${d.sector.id}`} label="This sector" compact />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Products requested by buyers" subtitle="Each product with the number of buyers asking for it, and approved sellers offering it" />
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-2.5 text-left">Product</th><th className="px-3 py-2.5 text-right">Buyers</th><th className="px-5 py-2.5 text-left">Requested by</th><th className="px-3 py-2.5 text-right">Sellers offering</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.products.map((p) => (
                  <tr key={p.product}>
                    <td className="whitespace-nowrap px-5 py-2.5 font-medium text-ink">{p.product}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{p.buyers}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-600">{p.buyerNames.join(", ")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.sellers ? <Badge tone="green">{p.sellers}</Badge> : <Badge tone="red">0</Badge>}</td>
                  </tr>
                ))}
                {!d.products.length && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">No buyer has asked for this sector yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Certifications buyers require" />
          <ul className="divide-y divide-slate-100">
            {d.certifications.map((c) => (
              <li key={c.name} className="flex justify-between px-5 py-2 text-sm"><span className="text-slate-700">{c.name}</span><span className="font-semibold tabular-nums">{c.n}</span></li>
            ))}
            {!d.certifications.length && <li className="px-5 py-6 text-center text-sm text-slate-500">None specified.</li>}
          </ul>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Buyer requirements in this sector" />
        <div className="table-scroll relative overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Buyer</th><th className="px-4 py-3">Products</th><th className="px-4 py-3">Specifications</th><th className="px-4 py-3">Certifications</th><th className="px-4 py-3">Volume</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.buyers.map((b) => (
                <tr key={b.itemId} className="align-top hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <Link href={`${buyerBase}/${b.buyerId}#item-${b.itemId}`} className="font-semibold text-ink hover:text-brand-700">{b.name}</Link>
                    <div className="text-xs text-slate-500">{b.country} · <span className="whitespace-nowrap font-mono">{b.approvedNo ?? b.regNo}</span></div>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{b.products}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{b.specifications || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{b.certifications.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{b.quantity || "—"}{b.sourcingValue && <div className="text-slate-400">{b.sourcingValue}</div>}</td>
                  <td className="px-4 py-3"><Badge tone={ITEM_META[b.status].tone}>{ITEM_META[b.status].short}</Badge></td>
                </tr>
              ))}
              {!d.buyers.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No buyer requirements in this sector.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Approved sellers in this sector" subtitle="Products in green match what buyers asked for" />
        <div className="table-scroll relative overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Seller</th><th className="px-4 py-3">District</th><th className="px-4 py-3">Products ready to export</th><th className="px-4 py-3">Export exp.</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.sellers.map((s) => (
                <tr key={s.id} className="align-top hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <Link href={`${sellerBase}/${s.id}`} className="font-semibold text-ink hover:text-brand-700">{s.name}</Link>
                    <div className="whitespace-nowrap font-mono text-xs text-slate-500">{s.approvedNo}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.district}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {s.products.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean).map((p) => (
                        <span key={p} className={s.matches.includes(p) ? "rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-800 ring-1 ring-green-300" : "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">{s.exportExperience ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">No</Badge>}</td>
                </tr>
              ))}
              {!d.sellers.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No approved sellers in this sector yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
