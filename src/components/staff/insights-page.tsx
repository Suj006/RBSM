import Link from "next/link";
import { AlertTriangle, Award, Clock, Gauge, Handshake, Map, PackageX, Globe2 } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { AGE_BUCKETS, buildInsights } from "@/lib/insights";
import { Badge, Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { BarList } from "@/components/charts";
import { DownloadButtons } from "./download-buttons";

const fmtDays = (d: number | null) => (d === null ? "—" : d < 1 ? "< 1 day" : `${d.toFixed(1)} days`);

/** Heat-map cell: stronger colour for higher values (rgb is the TRADEX green or blue). */
function Heat({ v, max, rgb, href }: { v: number; max: number; rgb: string; href?: string }) {
  const a = v ? 0.12 + 0.68 * (v / Math.max(1, max)) : 0;
  const body = <span className={v ? (a > 0.5 ? "font-bold text-white" : "font-semibold text-ink") : "text-slate-300"}>{v || "·"}</span>;
  return (
    <td className="border border-white p-0 text-center tabular-nums" style={{ backgroundColor: v ? `rgba(${rgb}, ${a})` : "#f8fafc" }}>
      {href && v ? <Link href={href} className="block px-2 py-2 hover:underline">{body}</Link> : <div className="px-2 py-2">{body}</div>}
    </td>
  );
}

function Section({ id, icon, title, children, note }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode; note?: string }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-ink text-white">{icon}</span>
        <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
      </div>
      {note && <p className="-mt-1 mb-4 max-w-4xl text-sm text-slate-500">{note}</p>}
      {children}
    </section>
  );
}

export async function InsightsPage({ user, root }: { user: User; root: string }) {
  const d = await buildInsights(user);
  const s = d.summary;
  const maxDS = Math.max(0, ...d.districtSector.flatMap((r) => r.cells));
  const maxCS = Math.max(0, ...d.countrySector.flatMap((r) => r.cells));
  const STATUS = {
    ready: <Badge tone="green">Ready</Badge>,
    sector: <Badge tone="amber">Sector match only</Badge>,
    short: <Badge tone="red">Short of sellers</Badge>,
  };

  return (
    <>
      <PageHeader eyebrow="Directorate · central view" title="Insights"
        subtitle="What the numbers mean for the event: which buyers are ready for matchmaking, where supply falls short, where sellers and demand come from, and how fast applications move."
        actions={<DownloadButtons href="/api/reports/insights" label="Insights report" compact />} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Approved buyers ready for matchmaking" value={`${s.ready} / ${s.approvedBuyers}`} accent="green"
          hint={`At least ${d.target} approved sellers offering their products`} />
        <StatCard label="Approved buyers short of sellers" value={s.short} accent="red" hint={`Fewer than ${d.target} approved sellers even in their sectors`} />
        <StatCard label="Products with no supplier" value={`${s.productGaps} / ${s.products}`} accent="yellow" hint="Requested products no approved seller offers" href={`${root}/products?view=gaps`} />
        <StatCard label="Pending more than 7 days" value={s.overdue} accent="violet" hint={`Of ${s.pendingItems} buyer sectors and all sellers in verification`} />
      </div>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Sections">
        {[["readiness", "Matchmaking readiness"], ["gaps", "Supply gaps"], ["supply", "District × sector supply"], ["markets", "Markets × sectors"], ["certs", "Certifications"], ["speed", "Turnaround & ageing"]].map(([h, l]) => (
          <a key={h} href={`#${h}`} className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-600 ring-1 ring-slate-200 hover:text-brand-700">{l}</a>
        ))}
      </nav>

      <Section id="readiness" icon={<Handshake className="size-4" />} title="Matchmaking readiness — approved buyers"
        note={`For every approved buyer: approved sellers in the buyer's approved sectors, and those offering the very products the buyer asked for. Target: ${d.target} sellers per buyer.`}>
        <Card className="overflow-hidden">
          {d.readiness.length ? (
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Buyer</th><th className="px-3 py-2.5 text-left">Country</th><th className="px-3 py-2.5 text-left">Approved sectors</th>
                    <th className="px-3 py-2.5 text-right">Sellers in sectors</th><th className="px-3 py-2.5 text-right">Product-matched sellers</th><th className="px-4 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.readiness.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2"><Link href={`${root}/buyers/${r.id}`} className="font-semibold text-ink hover:text-brand-700">{r.name}</Link>
                        <div className="whitespace-nowrap font-mono text-[11px] text-slate-500">{r.approvedNo}</div></td>
                      <td className="px-3 py-2 text-slate-600">{r.country}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{r.sectors.join(", ")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.sectorSellers}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{r.productSellers}</td>
                      <td className="px-4 py-2">{STATUS[r.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="p-6 text-sm text-slate-500">No approved buyers yet.</p>}
        </Card>
      </Section>

      <Section id="gaps" icon={<AlertTriangle className="size-4" />} title="Supply gaps"
        note="Where approved demand is not yet matched by approved sellers — the brief for district centres to mobilise MSMEs.">
        <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden">
            <CardHeader title="Sectors short of sellers" subtitle={`Sellers needed = approved buyers × ${d.target}`} />
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2.5 text-left">Sector</th><th className="px-3 py-2.5 text-right">Approved buyers</th><th className="px-3 py-2.5 text-right">Needed</th>
                    <th className="px-3 py-2.5 text-right">Approved sellers</th><th className="px-3 py-2.5 text-right">Export-ready</th><th className="px-4 py-2.5 text-right">Shortfall</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.sectorGaps.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <td className="min-w-48 px-4 py-2 font-medium text-ink"><Link href={`${root}/demand/${g.id}`} className="hover:text-brand-700">{g.name}</Link></td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.approvedBuyers}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{g.needed}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.sellers}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{g.exportReady}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{g.shortfall ? <span className="font-bold text-tx-red">{g.shortfall}</span> : <span className="font-semibold text-brand-700">Met</span>}</td>
                    </tr>
                  ))}
                  {!d.sectorGaps.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No approved buyer sectors yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="Products with no supplier" subtitle="Most-requested first" icon={<PackageX className="size-4" />}
              action={<Link href={`${root}/products?view=gaps`} className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>} />
            <ul className="divide-y divide-slate-100">
              {d.productGaps.slice(0, 12).map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div className="min-w-0"><div className="truncate font-medium text-ink">{p.product}</div><div className="text-xs text-slate-500">{p.sectorName}</div></div>
                  <span className="shrink-0 text-xs text-slate-500"><b className="text-ink">{p.approvedBuyers + p.pendingBuyers}</b> buyer{p.approvedBuyers + p.pendingBuyers > 1 ? "s" : ""}</span>
                </li>
              ))}
              {!d.productGaps.length && <li className="px-5 py-6 text-center text-sm text-slate-500">Every requested product has at least one approved seller.</li>}
            </ul>
          </Card>
        </div>
      </Section>

      <Section id="supply" icon={<Map className="size-4" />} title="Where supply sits — approved sellers by district and sector"
        note="Darker cells = more approved sellers. Use it to see which districts to approach for a sector. Top 10 sectors by approved sellers.">
        <Card className="overflow-hidden">
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wide">District</th>
                  {d.supplySectors.map((x) => <th key={x.id} className="px-1.5 py-2.5 text-center font-semibold leading-tight">{x.name}</th>)}
                  <th className="px-3 py-2.5 text-right uppercase tracking-wide">Sellers</th>
                </tr>
              </thead>
              <tbody>
                {d.districtSector.map((r) => (
                  <tr key={r.district}>
                    <td className="whitespace-nowrap px-3 py-1.5 text-sm font-medium text-ink">{r.district}</td>
                    {r.cells.map((v, i) => <Heat key={i} v={v} max={maxDS} rgb="60, 181, 74"
                      href={`${root}/${user.role === "FIEO" ? "seller-list" : "sellers"}?${user.role === "FIEO" ? "" : "status=APPROVED&"}district=${encodeURIComponent(r.district)}&sector=${d.supplySectors[i].id}`} />)}
                    <td className="px-3 py-1.5 text-right text-sm font-bold tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section id="markets" icon={<Globe2 className="size-4" />} title="Which markets want what — buyer requirements by country and sector"
        note="Submitted buyer requirements (approved and pending), top 12 countries × top 8 sectors. Useful for planning sector sessions and country focus.">
        <Card className="overflow-hidden">
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wide">Country</th>
                  {d.demandSectors.map((x) => <th key={x.id} className="px-1.5 py-2.5 text-center font-semibold leading-tight">{x.name}</th>)}
                  <th className="px-3 py-2.5 text-right uppercase tracking-wide">All sectors</th>
                </tr>
              </thead>
              <tbody>
                {d.countrySector.map((r) => (
                  <tr key={r.country}>
                    <td className="whitespace-nowrap px-3 py-1.5 text-sm font-medium text-ink">{r.country}</td>
                    {r.cells.map((v, i) => <Heat key={i} v={v} max={maxCS} rgb="46, 163, 230"
                      href={`${root}/requirements?item=&country=${encodeURIComponent(r.country)}&sector=${d.demandSectors[i].id}`} />)}
                    <td className="px-3 py-1.5 text-right text-sm font-bold tabular-nums">{r.total}</td>
                  </tr>
                ))}
                {!d.countrySector.length && <tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-slate-500">No buyer requirements yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section id="certs" icon={<Award className="size-4" />} title="Certifications buyers require"
        note="How many sector requirements ask for each certification — a guide for MSME capacity building before the event.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="All submitted requirements" />
            <div className="p-6"><BarList data={d.certifications.slice(0, 12).map((c) => ({ label: c.name, value: c.all }))} color="bg-tx-yellow" empty="No certifications requested yet." /></div>
          </Card>
          <Card>
            <CardHeader title="Approved requirements" />
            <div className="p-6"><BarList data={d.certifications.filter((c) => c.approved).sort((a, b) => b.approved - a.approved).slice(0, 12).map((c) => ({ label: c.name, value: c.approved }))} color="bg-tx-green" empty="No approved requirements yet." /></div>
          </Card>
        </div>
      </Section>

      <Section id="speed" icon={<Gauge className="size-4" />} title="Turnaround and ageing"
        note="Average time each stage takes (including any correction rounds), and how long items now pending have been waiting.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {d.turnaround.map((t) => (
            <Card key={t.stage} className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.stage}</div>
              <div className="mt-2 text-2xl font-extrabold text-ink">{fmtDays(t.days)}</div>
              <div className="text-xs text-slate-500">average over {t.n} file{t.n === 1 ? "" : "s"}</div>
            </Card>
          ))}
        </div>
        <Card className="mt-6 overflow-hidden">
          <CardHeader title="Pending now, by waiting time" icon={<Clock className="size-4" />} />
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">Stage</th>{AGE_BUCKETS.map((b) => <th key={b} className="px-3 py-2.5 text-right">{b}</th>)}
                  <th className="px-3 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Oldest</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.ageing.filter((a) => user.role !== "FIEO" || a.stage.startsWith("Buyer")).map((a) => (
                  <tr key={a.stage} className="hover:bg-slate-50">
                    <td className="px-4 py-2"><Link href={`${root}/${a.href}`} className="font-medium text-ink hover:text-brand-700">{a.stage}</Link></td>
                    {a.buckets.map((v, i) => (
                      <td key={i} className={`px-3 py-2 text-right tabular-nums ${v && i >= 2 ? (i === 3 ? "font-bold text-tx-red" : "font-semibold text-amber-700") : v ? "" : "text-slate-300"}`}>{v}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{a.total}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{a.oldest === null ? "—" : `${a.oldest} day${a.oldest === 1 ? "" : "s"}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>
    </>
  );
}
