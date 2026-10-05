import Link from "next/link";
import { AlertTriangle, Award, Clock, Gauge, Handshake, Map, PackageX, Globe2, Compass, Filter, TrendingUp, RotateCcw, Building2, ArrowRight, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import type { User } from "@/generated/prisma/client";
import { AGE_BUCKETS, buildInsights } from "@/lib/insights";
import { buildDecisionView, type FunnelStep } from "@/lib/decision";
import { Badge, Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { BarList } from "@/components/charts";
import { DownloadButtons } from "./download-buttons";
import { CountryTag } from "@/components/ids";

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

function Funnel({ title, steps, tone }: { title: string; steps: FunnelStep[]; tone: string }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <Card>
      <CardHeader title={title} subtitle={`${steps.length ? Math.round(((steps.at(-1)!.value) / top) * 100) : 0}% of ${steps[0]?.label.toLowerCase()} reach the last step`} />
      <ol className="space-y-3 p-5">
        {steps.map((st, i) => {
          const prev = i ? steps[i - 1].value : st.value;
          const conv = prev ? Math.round((st.value / prev) * 100) : 0;
          const body = (
            <>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-ink">{st.label}</span>
                <span className="tabular-nums"><b className="text-ink">{st.value}</b>{i > 0 && <span className={cn("ml-2 text-xs", conv < 60 ? "font-semibold text-tx-red" : "text-slate-500")}>{conv}% of previous</span>}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100"><div className={cn("h-3 rounded-full", tone)} style={{ width: `${Math.max(st.value ? 2 : 0, (st.value / top) * 100)}%` }} /></div>
            </>
          );
          return <li key={st.label}>{st.href ? <Link href={st.href} className="block rounded-lg hover:bg-slate-50">{body}</Link> : body}</li>;
        })}
      </ol>
    </Card>
  );
}

const FINDING = {
  red: "border-l-tx-red bg-red-50/40", amber: "border-l-tx-yellow bg-amber-50/40", green: "border-l-tx-green bg-brand-50/40", blue: "border-l-tx-blue bg-sky-50/40",
} as const;

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
  const v = await buildDecisionView(d, root);
  const s = d.summary;
  const P = v.profile.summary;
  const pc = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
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
        {[["findings", "Key findings"], ["funnel", "Funnels"], ["pace", "Targets & pace"], ["districts", "Districts"], ["profile", "Seller profile"], ["readiness", "Matchmaking readiness"], ["gaps", "Supply gaps"], ["supply", "District × sector supply"], ["markets", "Markets × sectors"], ["certs", "Certifications"], ["rework", "Rework"], ["speed", "Turnaround & ageing"], ["matching", "Matchmaking position"]].map(([h, l]) => (
          <a key={h} href={`#${h}`} className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-600 ring-1 ring-slate-200 hover:text-brand-700">{l}</a>
        ))}
      </nav>

      <Section id="findings" icon={<Compass className="size-4" />} title="Key findings and recommended actions"
        note="Generated from the live data each time the page opens — the points that most need the Directorate's attention.">
        <div className="grid gap-3 lg:grid-cols-2">
          {v.findings.map((f) => (
            <div key={f.title} className={cn("rounded-xl border border-l-4 border-slate-200 p-4", FINDING[f.tone])}>
              <div className="font-bold text-ink">{f.title}</div>
              <p className="mt-1 text-sm text-slate-600">{f.detail}</p>
              {(f.action || f.href) && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  {f.action && <span className="font-medium text-slate-800">→ {f.action}</span>}
                  {f.href && <Link href={f.href} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">Open <ArrowRight className="size-3.5" /></Link>}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section id="funnel" icon={<Filter className="size-4" />} title="Registration funnels"
        note="How many buyers and sellers reach each stage, and the conversion from the previous stage (red below 60%) — to see where applicants drop out.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Funnel title="International buyers" steps={v.buyerFunnel} tone="bg-tx-blue" />
          <Funnel title="Kerala MSME sellers" steps={v.sellerFunnel} tone="bg-tx-green" />
        </div>
      </Section>

      <Section id="pace" icon={<TrendingUp className="size-4" />} title="Progress to targets and pace"
        note="Approvals in the last 14 days, and how long the target will take at that pace.">
        <div className="grid gap-4 md:grid-cols-2">
          {v.pace.map((p) => {
            const pc = p.target ? Math.min(100, (p.value / p.target) * 100) : 0;
            return (
              <Card key={p.label} className="p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={p.href} className="font-bold text-ink hover:text-brand-700">{p.label}</Link>
                  <span className="text-sm tabular-nums"><b className="text-2xl font-extrabold text-ink">{p.value}</b> / {p.target}</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-tx-green" style={{ width: `${Math.max(pc, p.value ? 2 : 0)}%` }} /></div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-slate-600">
                  <span>{pc.toFixed(0)}% of target · {Math.max(0, p.target - p.value)} to go</span>
                  <span className={cn("font-semibold", p.weeks === null ? "text-tx-red" : p.weeks > 4 ? "text-amber-700" : "text-brand-700")}>
                    {p.value >= p.target ? "Target reached" : p.weeks === null ? "No approvals in 14 days" : `${p.perWeek.toFixed(1)}/week · ~${p.weeks} week${p.weeks === 1 ? "" : "s"} to target`}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section id="districts" icon={<Building2 className="size-4" />} title="District performance"
        note="District Industries Centres ranked by approved sellers against target, with speed of recommendation and files waiting over 7 days.">
        <Card className="overflow-hidden">
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">#</th><th className="px-3 py-2.5 text-left">District</th><th className="px-3 py-2.5 text-right">Registered</th>
                  <th className="px-3 py-2.5 text-right">Approved</th><th className="px-3 py-2.5 text-right">Target</th><th className="w-48 px-3 py-2.5 text-left">Achieved</th>
                  <th className="px-3 py-2.5 text-right">With district</th><th className="px-3 py-2.5 text-right">Waiting &gt; 7 days</th><th className="px-3 py-2.5 text-right">Avg days to recommend</th><th className="px-4 py-2.5 text-right">Rejected</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {v.districts.map((r, i) => (
                  <tr key={r.district} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-ink"><Link href={`${root}/sellers?district=${encodeURIComponent(r.district)}`} className="hover:text-brand-700">{r.district}</Link></td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.registered}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.approved}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.target}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100"><div className={cn("h-2 rounded-full", r.achieved >= 1 ? "bg-tx-green" : r.achieved >= 0.5 ? "bg-tx-yellow" : "bg-tx-red")} style={{ width: `${Math.min(100, r.achieved * 100)}%` }} /></div>
                        <span className="w-10 text-right text-xs tabular-nums">{Math.round(r.achieved * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.pendingWithDistrict}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", r.waitingOver7 ? "font-bold text-tx-red" : "text-slate-400")}>{r.waitingOver7}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.avgDaysToRecommend === null ? "—" : r.avgDaysToRecommend.toFixed(1)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{r.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section id="profile" icon={<UsersRound className="size-4" />} title="Seller profile — who the approved sellers are"
        note="From the profile each approved seller completes after approval: promoters (women, SC / ST, specially abled), unit category, type and constitution, and export credentials. Percentages are of completed profiles.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Profiles completed" value={`${P.completed} / ${P.approved}`} accent="green"
            hint={P.pending ? `${P.pending} pending with sellers` : "All approved sellers"} href={`${root}/seller-list?profile=pending`} />
          <StatCard label="Women promoters" value={P.women} accent="violet" hint={`${pc(P.women, P.completed)}% of completed profiles`} href={`${root}/seller-list?promoter=women`} />
          <StatCard label="SC / ST promoters" value={P.scst} accent="blue" hint={`${pc(P.scst, P.completed)}% · specially abled: ${P.disabled}`} href={`${root}/seller-list?promoter=scst`} />
          <StatCard label="With IEC number" value={`${P.withIec} / ${P.approved}`} accent="yellow"
            hint={`${P.certified} hold quality / product certifications${P.expNoIec ? ` · ${P.expNoIec} exporters without IEC` : ""}`} href={`${root}/seller-list?iec=no`} />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card><CardHeader title="Category of unit" />
            <div className="p-5"><BarList data={v.profile.dims.category.map((o) => ({ label: o.label, value: o.n, href: `${root}/seller-list?cat=${o.value}` }))} color="bg-tx-green" empty="No profiles yet." /></div></Card>
          <Card><CardHeader title="Unit type" />
            <div className="p-5"><BarList data={v.profile.dims.unitType.map((o) => ({ label: o.label, value: o.n, href: `${root}/seller-list?utype=${o.value}` }))} color="bg-tx-blue" empty="No profiles yet." /></div></Card>
          <Card><CardHeader title="Social category of promoters" />
            <div className="p-5"><BarList data={v.profile.dims.social.map((o) => ({ label: o.label, value: o.n }))} color="bg-violet-500" empty="No profiles yet." /></div></Card>
          <Card><CardHeader title="Gender of promoters" />
            <div className="p-5"><BarList data={v.profile.dims.gender.filter((o) => o.n).map((o) => ({ label: o.label, value: o.n }))} color="bg-pink-500" empty="No profiles yet." /></div></Card>
          <Card className="lg:col-span-2"><CardHeader title="Constitution of unit" />
            <div className="p-5"><BarList data={v.profile.dims.constitution.filter((o) => o.n).map((o) => ({ label: o.label, value: o.n }))} color="bg-tx-yellow" empty="No profiles yet." /></div></Card>
          <Card className="lg:col-span-3"><CardHeader title="Where approved sellers already export" subtitle={`${P.exporters} approved sellers have given their export history — for reference only, not used in matchmaking. Approved buyers from each country in brackets.`} />
            <div className="p-5"><BarList data={v.profile.exportMarkets.slice(0, 12).map((m) => ({ label: `${m.country}${m.buyers ? ` (${m.buyers} buyer${m.buyers > 1 ? "s" : ""})` : ""}`, value: m.sellers }))} color="bg-sky-500" empty="No export history yet." /></div></Card>
        </div>
        <Card className="mt-6 overflow-hidden">
          <CardHeader title="District-wise profile of approved sellers" subtitle="Counts of completed profiles; IEC and certifications cover all approved sellers." />
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">District</th>
                  {["Approved", "Profile done", "Pending", "Women", "SC/ST", "Sp. abled", "Micro", "Small", "Medium", "Large", "Mfg.", "Service", "Trade", "IEC", "Certified"].map((h) => (
                    <th key={h} className="px-2 py-2.5 text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {v.profile.byDistrict.map((r) => (
                  <tr key={r.district} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-ink">{r.district}</td>
                    {[r.approved, r.completed].map((n, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{n}</td>)}
                    <td className={cn("px-2 py-2 text-right tabular-nums", r.pending ? "font-semibold text-tx-red" : "text-slate-300")}>
                      {r.pending ? <Link href={`${root}/seller-list?profile=pending&district=${encodeURIComponent(r.district)}`} className="hover:underline">{r.pending}</Link> : 0}
                    </td>
                    {[r.women, r.scst, r.disabled, r.micro, r.small, r.medium, r.large, r.mfg, r.service, r.trade, r.withIec, r.certified].map((n, i) => (
                      <td key={i} className={cn("px-2 py-2 text-right tabular-nums", !n && "text-slate-300")}>{n}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

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
                      <td className="px-3 py-2 text-slate-600"><CountryTag country={r.country} name /></td>
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
                    <td className="whitespace-nowrap px-3 py-1.5 text-sm font-medium text-ink"><CountryTag country={r.country} name /></td>
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
        <Card className="mt-6 overflow-hidden">
          <CardHeader title="Certification readiness — approved demand against approved sellers"
            subtitle="For each certification approved buyer sectors require: approved sellers holding it, and how many of them work in those sectors. Gaps first." />
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">Certification</th><th className="px-3 py-2.5 text-left">Required in sectors</th>
                  <th className="px-3 py-2.5 text-right">Approved buyer sectors</th><th className="px-3 py-2.5 text-right">Sellers holding it</th>
                  <th className="px-3 py-2.5 text-right">…in those sectors</th><th className="px-4 py-2.5 text-left">Position</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {v.profile.certReadiness.map((c) => (
                  <tr key={c.name} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-ink">{c.name}</td>
                    <td className="max-w-72 px-3 py-2 text-xs text-slate-600">{c.sectors.join(", ")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.buyerSectors}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.holders}</td>
                    <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", !c.inSector && "text-tx-red")}>{c.inSector}</td>
                    <td className="px-4 py-2">{!c.inSector ? <Badge tone="red">No certified seller</Badge> : c.inSector < c.buyerSectors ? <Badge tone="amber">Thin</Badge> : <Badge tone="green">Covered</Badge>}</td>
                  </tr>
                ))}
                {!v.profile.certReadiness.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">No certifications required in approved buyer sectors yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section id="rework" icon={<RotateCcw className="size-4" />} title="Rework and rejection"
        note="How often files are sent back at each stage. High rates suggest guidance or forms need to be clearer.">
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {v.rework.map((r) => {
              const pc = r.of ? (r.count / r.of) * 100 : 0;
              return (
                <li key={r.label}>
                  <Link href={r.href} className="grid items-center gap-2 px-5 py-3 text-sm hover:bg-slate-50 sm:grid-cols-[1fr_200px_110px]">
                    <span className="font-medium text-ink">{r.label}</span>
                    <div className="h-2 rounded-full bg-slate-100"><div className={cn("h-2 rounded-full", pc >= 20 ? "bg-tx-red" : pc >= 10 ? "bg-tx-yellow" : "bg-tx-green")} style={{ width: `${Math.max(pc, r.count ? 2 : 0)}%` }} /></div>
                    <span className="text-right tabular-nums"><b>{r.count}</b> <span className="text-slate-500">of {r.of} · {pc.toFixed(0)}%</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
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
      <Section id="matching" icon={<Handshake className="size-4" />} title={`Matchmaking position — ${v.state.version ? `published version ${v.state.version}${v.state.locked ? " (final)" : ""}` : "working list (not published)"}`}
        note="Coverage of the buyer–seller mapping. Full detail, with the products and sectors left out, is on Matchmaking → Results & gaps.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Buyer–seller pairs" value={v.cov.pairs} accent="blue" hint={`${v.cov.source.preference} preference · ${v.cov.source.system} system · ${v.cov.source.manual} manual`} href={`${root}/matchmaking/results`} />
          <StatCard label={`Buyers with ${v.cov.target}+ sellers`} value={`${v.cov.buyersAtTarget} / ${v.cov.buyers}`} accent="green" hint={`${v.cov.sellersNeeded} seller slot${v.cov.sellersNeeded === 1 ? "" : "s"} still needed`} href={`${root}/matchmaking/results`} />
          <StatCard label="Sellers with a buyer" value={`${v.cov.sellersMatched} / ${v.cov.sellers}`} accent="violet" hint={`${v.cov.sellersWithout.length} approved seller${v.cov.sellersWithout.length === 1 ? "" : "s"} without a buyer`} href={`${root}/matchmaking/results`} />
          <StatCard label="Requested products not covered" value={v.cov.productGaps.length} accent="red" hint={`${v.cov.productGaps.filter((p) => !p.availableSellers).length} with no approved seller at all`} href={`${root}/matchmaking/results`} />
        </div>
      </Section>
    </>
  );
}
