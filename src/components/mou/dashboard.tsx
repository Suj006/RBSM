import Link from "next/link";
import { FileSignature, Globe2, Handshake, Landmark, Trophy } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { fmtDateTime } from "@/lib/format";
import { fmtInr, fmtMonth, fmtUsd, MOU_STATUS, mouStageShort, shortInr, shortUsd } from "@/lib/mou";
import { mouStats, type Agg } from "@/lib/mou-stats";
import { setMouRateAction } from "@/app/actions/mou";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { AutoRefresh } from "@/components/event/auto-refresh";
import { InlineForm } from "@/components/event/inline";
import { Flag, uid } from "@/components/ids";
import { cn } from "@/lib/cn";

const both = (usd: number, inr: number) => <><span className="whitespace-nowrap">{shortUsd(usd)}</span> <span className="whitespace-nowrap text-slate-400">·</span> <span className="whitespace-nowrap">{shortInr(inr)}</span></>;

function Big({ label, usd, inr, sub, tone }: { label: string; usd?: number; inr?: number; sub?: React.ReactNode; tone: string }) {
  return (
    <div className={cn("rounded-2xl p-5 ring-1", tone)}>
      <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      {usd !== undefined && <div className="mt-1 text-3xl font-extrabold tabular-nums">{fmtUsd(usd)}</div>}
      {inr !== undefined && <div className="text-lg font-bold tabular-nums opacity-90">{fmtInr(inr)}</div>}
      {sub && <div className="mt-1 text-xs opacity-80">{sub}</div>}
    </div>
  );
}
function Kpi({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const body = <><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{value}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}</>;
  return href ? <Link href={href} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:ring-brand-300">{body}</Link> : <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">{body}</div>;
}

/** Bars by value (US$), with INR and the number of MoUs. */
function ValueBars({ rows, empty = "No MoUs yet.", flag, href }: { rows: Agg[]; empty?: string; flag?: boolean; href?: (r: Agg) => string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.usd), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700">{flag && <Flag country={r.country ?? r.label} />}
              {href ? <Link href={href(r)} className="truncate hover:text-brand-700 hover:underline">{r.label}</Link> : <span className="truncate">{r.label}</span>}
              {r.sub && <span className="truncate font-mono text-[10px] text-slate-400">{r.sub}</span>}</span>
            <span className="shrink-0 text-right text-xs tabular-nums"><b className="text-ink">{both(r.usd, r.inr)}</b> <span className="text-slate-500">· {r.count} MoU{r.count === 1 ? "" : "s"}{r.tbd ? ` (${r.tbd} TBD)` : ""}</span></span>
          </div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-tx-green" style={{ width: `${Math.max(2, (r.usd / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Columns({ rows, label }: { rows: Agg[]; label: (k: string) => string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">No MoUs yet.</p>;
  const max = Math.max(...rows.map((r) => r.usd), 1);
  return (
    <div className="flex h-48 items-end gap-2">
      {rows.map((r) => (
        <div key={r.key} className="group flex h-full min-w-0 flex-1 flex-col justify-end text-center" title={`${label(r.key)}: ${fmtUsd(r.usd)} · ${fmtInr(r.inr)} · ${r.count} MoUs`}>
          <div className="text-[10px] font-semibold tabular-nums text-slate-600">{shortUsd(r.usd)}</div>
          <div className="rounded-t bg-tx-blue/80 group-hover:bg-tx-blue" style={{ height: `${(r.usd / max) * 75}%`, minHeight: 4 }} />
          <div className="mt-1 truncate text-[10px] text-slate-500">{label(r.key)}</div>
          <div className="text-[10px] text-slate-400">{r.count}</div>
        </div>
      ))}
    </div>
  );
}

/** Live MoU dashboard (Directorate, FIEO, Admin). */
export async function MouDashboard({ user, base, scope }: { user: User; base: string; scope?: string }) {
  const sc = scope === "approved" ? "approved" : "signed";
  const s = await mouStats(sc);
  const t = s.totals;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const scopeLabel = sc === "approved" ? "approved MoUs" : "MoUs signed (approved + awaiting verification)";
  return (
    <>
      <PageHeader eyebrow="Memorandum of understanding" title="MoU dashboard"
        subtitle={<>Live position of MoUs signed after buyer–seller meetings. Breakdowns show {scopeLabel}. Values in US$ and INR at 1 US$ = ₹ {s.rate}.</>}
        actions={<div className="flex flex-wrap items-center gap-3"><AutoRefresh seconds={30} /><DownloadButtons href="/api/reports/mou-register" label="MoU register" compact /></div>} />
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <Link href={base} className={cn("rounded-lg px-3 py-1.5 font-semibold ring-1", sc === "signed" ? "bg-ink text-white ring-ink" : "text-slate-600 ring-slate-200")}>All signed</Link>
        <Link href={`${base}?scope=approved`} className={cn("rounded-lg px-3 py-1.5 font-semibold ring-1", sc === "approved" ? "bg-ink text-white ring-ink" : "text-slate-600 ring-slate-200")}>Approved only</Link>
        {user.role === "DIC" && <span className="ml-auto inline-flex items-center gap-2 text-xs text-slate-500">Exchange rate 1 US$ = ₹
          <InlineForm action={setMouRateAction} fields={{}} label="Set rate"><input name="rate" defaultValue={s.rate} inputMode="decimal" aria-label="Rupees per US dollar" className="w-20 rounded-lg border-0 px-2 py-1.5 text-sm ring-1 ring-slate-300" /></InlineForm></span>}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Big label="Approved MoUs — total value" usd={t.approved.usd} inr={t.approved.inr} tone="bg-brand-700 text-white ring-brand-800"
          sub={<>{t.approved.count} MoUs approved{t.approved.tbd ? ` · ${t.approved.tbd} with value to be determined` : ""}</>} />
        <Big label="Awaiting verification — value" usd={t.pending.usd} inr={t.pending.inr} tone="bg-amber-50 text-amber-950 ring-amber-300"
          sub={<>{t.pending.count} MoUs · {t.pending.awaitingNodal} with nodal officers · {t.pending.awaitingFieo} with FIEO</>} />
        <Big label="All signed — value" usd={t.signed.usd} inr={t.signed.inr} tone="bg-white text-ink ring-slate-200"
          sub={<>{t.signed.count} MoUs · average {shortUsd(t.avgUsd)} per MoU with a value</>} />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="MoUs approved" value={t.approved.count} sub={`${t.returned} returned · ${t.withdrawn} withdrawn`} href={`${base}/list?status=APPROVED`} />
        <Kpi label="Awaiting nodal officer" value={t.pending.awaitingNodal} href={`${base}/list?stage=nodal`} />
        <Kpi label="Awaiting FIEO" value={t.pending.awaitingFieo} href={`${base}/list?stage=fieo`} />
        <Kpi label="Buyers with an MoU" value={`${t.buyers} / ${t.approvedBuyers}`} sub={`${pct(t.buyers, t.approvedBuyers)} of approved buyers`} />
        <Kpi label="Sellers with an MoU" value={`${t.sellers} / ${t.approvedSellers}`} sub={`${pct(t.sellers, t.approvedSellers)} of approved sellers`} />
        <Kpi label="Meetings → MoUs" value={pct(t.withMeeting, t.meetingsDone)} sub={`${t.withMeeting} MoUs from ${t.meetingsDone} meetings held`} />
      </div>

      <div className="mb-6 space-y-6">
        <Card className="overflow-hidden">
          <CardHeader title="Recent MoUs" icon={<FileSignature className="size-4" />} subtitle="Newest first — refreshes every 30 seconds" action={<Link href={`${base}/list`} className="text-sm font-semibold text-brand-700 hover:underline">All MoUs →</Link>} />
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {s.recent.map((m) => (
                  <tr key={m.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-2.5"><Link href={`${base}/${m.id}`} className="font-mono text-xs font-bold text-brand-800 hover:underline">{m.mouNo}</Link><div className="text-[11px] text-slate-400">{fmtDateTime(m.submittedAt)}</div></td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-1.5 font-semibold text-ink"><Flag country={m.buyer.country} /> {m.buyer.name}</div><div className="text-xs text-slate-500">with {m.seller.name} <span className="font-mono">{uid(m.seller)}</span></div></td>
                    <td className="max-w-80 px-3 py-2.5 text-xs text-slate-600"><div className="line-clamp-2">{m.goods}</div><div className="text-slate-400">{m.sector?.name} · order {fmtMonth(m.orderMonth)}</div></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">{m.money ? <><b className="text-ink">{shortUsd(m.money.usd)}</b><div className="text-slate-500">{shortInr(m.money.inr)}</div></> : <span className="text-slate-500">TBD</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5"><Badge tone={MOU_STATUS[m.status].tone}>{mouStageShort(m)}</Badge></td>
                  </tr>
                ))}
                {!s.recent.length && <tr><td className="px-5 py-8 text-center text-slate-500">No MoUs yet. Buyers fill them from their login after a successful meeting.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid gap-6 lg:grid-cols-3">
          {s.biggest && (
            <Card className="p-5">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Trophy className="size-4 text-amber-500" /> Largest MoU</div>
              <div className="mt-1 text-2xl font-extrabold text-ink">{fmtUsd(s.biggest.money!.usd)}</div>
              <div className="text-sm text-slate-600">{fmtInr(s.biggest.money!.inr)}</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm"><Flag country={s.biggest.buyer.country} /> <b className="text-ink">{s.biggest.buyer.name}</b> ↔ {s.biggest.seller.name}</div>
              <div className="text-xs text-slate-500">{s.biggest.goods}</div>
              <Link href={`${base}/${s.biggest.id}`} className="mt-1 inline-block font-mono text-xs text-brand-700 hover:underline">{s.biggest.mouNo}</Link>
            </Card>
          )}
          <Card className="p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reach</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[["Countries", t.countries], ["Districts", t.districts], ["TBD values", t.tbd]].map(([l, v]) => <div key={String(l)}><div className="text-2xl font-extrabold text-ink">{v}</div><div className="text-xs text-slate-500">{l}</div></div>)}
            </div>
          </Card>
          <Card className="overflow-hidden"><CardHeader title="How values were entered" /><div className="p-5"><ValueBars rows={s.byCurrency} /></div></Card>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden"><CardHeader title="By buyer country" icon={<Globe2 className="size-4" />} /><div className="p-5"><ValueBars rows={s.byCountry} flag href={(r) => `${base}/list?country=${encodeURIComponent(r.key)}`} /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="By sector" icon={<Handshake className="size-4" />} /><div className="p-5"><ValueBars rows={s.bySector} href={(r) => `${base}/list?sector=${r.key}`} /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="Top buyers" subtitle="By value" /><div className="p-5"><ValueBars rows={s.byBuyer} flag /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="Top sellers" subtitle="By value" /><div className="p-5"><ValueBars rows={s.bySeller} /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="By seller district" icon={<Landmark className="size-4" />} /><div className="p-5"><ValueBars rows={s.byDistrict} href={(r) => `${base}/list?district=${encodeURIComponent(r.key)}`} /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="By nodal officer" subtitle="MoUs of the buyers each officer looks after" /><div className="p-5"><ValueBars rows={s.byNodal} /></div></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden"><CardHeader title="Order pipeline" subtitle="Value by the month buyers expect to place the order" /><div className="p-5"><Columns rows={s.byMonth} label={(k) => fmtMonth(k).replace(/ (\d{4})$/, " ’$1").replace("’20", "’")} /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="MoUs signed by day" subtitle="Value of MoUs filled each day" /><div className="p-5"><Columns rows={s.byDay} label={(k) => k.slice(5)} /></div></Card>
      </div>
      <p className="mt-4 text-xs text-slate-500">MoUs record the intention to order; values are the buyers&apos; approximate figures. Rupee and dollar values are converted at the rate above.</p>
    </>
  );
}
