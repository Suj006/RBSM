import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Building2, Clock, FileSignature, Globe2, Handshake, Hourglass, Landmark, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { fmtInr, fmtMonth, fmtUsd, MOU_STATUS, mouStageShort, shortInr, shortUsd } from "@/lib/mou";
import { mouStats, type Agg, type MouStats } from "@/lib/mou-stats";
import { countryCode } from "@/lib/country-codes";
import { setMouRateAction } from "@/app/actions/mou";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { AutoRefresh } from "@/components/event/auto-refresh";
import { InlineForm } from "@/components/event/inline";
import { Flag, uid } from "@/components/ids";
import { CountUp, DisplayMode } from "./live";
import { cn } from "@/lib/cn";

/** Colour pairs for bars and donuts — one per row, so every country / sector stands out. */
const PALETTE = [
  ["#34d399", "#059669"], ["#38bdf8", "#0284c7"], ["#a78bfa", "#7c3aed"], ["#fbbf24", "#ea580c"], ["#fb7185", "#e11d48"],
  ["#2dd4bf", "#0891b2"], ["#e879f9", "#c026d3"], ["#a3e635", "#16a34a"], ["#818cf8", "#4f46e5"], ["#f87171", "#dc2626"],
  ["#facc15", "#ca8a04"], ["#67e8f9", "#0e7490"],
] as const;
const grad = (i: number, dir = "90deg") => `linear-gradient(${dir}, ${PALETTE[i % PALETTE.length][0]}, ${PALETTE[i % PALETTE.length][1]})`;
const solid = (i: number) => PALETTE[i % PALETTE.length][1];

const STATUS_DOT: Record<string, string> = { APPROVED: "bg-emerald-400", SUBMITTED: "bg-amber-400", RETURNED: "bg-rose-400", WITHDRAWN: "bg-slate-400" };
const STATUS_CHIP: Record<string, string> = { APPROVED: "bg-emerald-100 text-emerald-800", SUBMITTED: "bg-amber-100 text-amber-800", RETURNED: "bg-rose-100 text-rose-800", WITHDRAWN: "bg-slate-100 text-slate-600" };

function ago(d: Date, now: number) {
  const m = Math.max(0, Math.round((now - d.getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
const both = (usd: number, inr: number) => <><span className="whitespace-nowrap">{shortUsd(usd)}</span> <span className="text-slate-300">·</span> <span className="whitespace-nowrap">{shortInr(inr)}</span></>;

/* ------------------------------------------------------------------ hero */

function Trend({ now, before }: { now: number; before: number }) {
  if (!now && !before) return <span className="text-white/50">—</span>;
  if (!before) return <span className="inline-flex items-center gap-0.5 text-emerald-300"><ArrowUpRight className="size-3.5" /> new today</span>;
  const p = Math.round(((now - before) / before) * 100);
  return p >= 0
    ? <span className="inline-flex items-center gap-0.5 text-emerald-300"><ArrowUpRight className="size-3.5" /> {p}% vs yesterday</span>
    : <span className="inline-flex items-center gap-0.5 text-rose-300"><ArrowDownRight className="size-3.5" /> {Math.abs(p)}% vs yesterday</span>;
}

/** Running total of MoUs, day by day. */
function Growth({ points }: { points: MouStats["trend"]["cumulative"] }) {
  if (points.length < 2) return null;
  const W = 320, H = 84, max = Math.max(...points.map((p) => p.count), 1);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * W, H - 6 - (p.count / max) * (H - 14)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" preserveAspectRatio="none" aria-label="MoUs signed — running total">
      <defs><linearGradient id="mou-growth" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#facc15" stopOpacity="0.55" /><stop offset="1" stopColor="#facc15" stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#mou-growth)" />
      <path d={line} fill="none" stroke="#facc15" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

type Recent = MouStats["recent"];

/** The scrolling strip of MoU tiles across the hero. */
function Ticker({ rows, now }: { rows: Recent; now: number }) {
  if (!rows.length) return null;
  const tile = (m: Recent[number], copy: number) => (
    <div key={`${copy}-${m.id}`} aria-hidden={copy ? true : undefined}
      className="flex w-80 shrink-0 items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
      <Flag country={m.buyer.country} className="text-3xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-bold text-white"><span className="truncate">{m.buyer.name}</span><span className="shrink-0 rounded bg-white/15 px-1 text-[10px] font-semibold">{countryCode(m.buyer.country)}</span></div>
        <div className="truncate text-xs text-white/70">↔ {m.seller.name} · {m.seller.district}</div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-white/60"><span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[m.status])} /> {m.sector?.name ?? "—"} · {ago(m.submittedAt, now)}</div>
      </div>
      <div className="shrink-0 text-right">
        {m.money ? <><div className="text-base font-extrabold text-yellow-300">{shortUsd(m.money.usd)}</div><div className="text-[11px] font-semibold text-white/70">{shortInr(m.money.inr)}</div></> : <div className="text-xs font-semibold text-white/60">Value TBD</div>}
      </div>
    </div>
  );
  return (
    <div className="relative overflow-hidden border-t border-white/10 bg-black/25 py-3">
      <div className="absolute inset-y-0 left-0 z-10 flex items-center bg-linear-to-r from-slate-950 via-slate-950/95 to-transparent pl-4 pr-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-white"><span className="tx-live-dot size-2 rounded-full bg-white" /> LIVE</span>
      </div>
      <div className="tx-marquee flex w-max gap-3 pl-36" style={{ "--tx-dur": `${Math.max(30, rows.length * 6)}s` } as React.CSSProperties}>
        {rows.map((m) => tile(m, 0))}{rows.map((m) => tile(m, 1))}
      </div>
    </div>
  );
}

function Hero({ s, now }: { s: MouStats; now: number }) {
  const t = s.totals, tr = s.trend;
  const value = s.scope === "approved" ? t.approved : t.signed;
  return (
    <section className="mb-6 overflow-hidden rounded-3xl bg-linear-to-br from-slate-950 via-[#0b3b2a] to-[#0c2d4d] text-white shadow-xl">
      <div className="h-1.5 bg-[linear-gradient(90deg,var(--color-tx-red)_0_25%,var(--color-tx-yellow)_25%_50%,var(--color-tx-green)_50%_75%,var(--color-tx-blue)_75%_100%)]" />
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1.3fr_1.3fr] lg:p-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300"><FileSignature className="size-4" /> MoUs signed</div>
          <div className="mt-1 text-7xl font-black leading-none tracking-tight text-white lg:text-8xl"><CountUp value={value.count} /></div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-emerald-200 ring-1 ring-emerald-400/40">{t.approved.count} approved</span>
            {s.scope === "signed" && <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-amber-200 ring-1 ring-amber-400/40">{t.pending.count} awaiting verification</span>}
          </div>
          <div className="mt-3 text-xs text-white/60">{tr.lastAt ? <>Last MoU {ago(tr.lastAt, now)}</> : "No MoUs yet"}</div>
        </div>
        <div className="lg:border-l lg:border-white/10 lg:pl-8">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Total value · {s.scope === "approved" ? "approved" : "signed"}</div>
          <div className="mt-2 text-4xl font-black tracking-tight text-yellow-300 xl:text-5xl"><CountUp value={value.usd} kind="usd" /></div>
          <div className="mt-1 text-2xl font-extrabold text-white/90 xl:text-3xl"><CountUp value={value.inr} kind="inr" /></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {([["Countries", t.countries, Globe2], ["Buyers", t.buyers, Users], ["Sellers", t.sellers, Building2]] as const).map(([l, v, I]) => (
              <div key={l} className="rounded-xl bg-white/5 py-2 ring-1 ring-white/10"><I className="mx-auto size-4 text-sky-300" /><div className="text-2xl font-extrabold"><CountUp value={v} /></div><div className="text-[11px] uppercase tracking-wider text-white/60">{l}</div></div>
            ))}
          </div>
        </div>
        <div className="lg:border-l lg:border-white/10 lg:pl-8">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-300">Today</div>
            <div className="text-xs"><Trend now={tr.today.count} before={tr.yesterday.count} /></div>
          </div>
          <div className="mt-1 flex items-end gap-4">
            <div><div className="text-5xl font-black leading-none"><CountUp value={tr.today.count} /></div><div className="text-[11px] uppercase tracking-wider text-white/60">MoUs today</div></div>
            <div className="pb-1"><div className="text-lg font-extrabold text-yellow-300">{shortUsd(tr.today.usd)}</div><div className="text-xs text-white/70">{shortInr(tr.today.inr)}</div></div>
            <div className="ml-auto pb-1 text-right"><div className="text-lg font-extrabold">{tr.lastHour}</div><div className="text-[11px] text-white/60">in the last hour</div></div>
          </div>
          <div className="mt-3"><Growth points={tr.cumulative} /></div>
          <div className="flex justify-between text-[10px] text-white/50"><span>{tr.cumulative[0]?.key.slice(5)}</span><span>Running total of MoUs</span><span>{tr.cumulative.at(-1)?.key.slice(5)}</span></div>
        </div>
      </div>
      <Ticker rows={s.recent.filter((m) => m.status === "APPROVED" || m.status === "SUBMITTED")} now={now} />
    </section>
  );
}

/* ------------------------------------------------------------------ tiles and charts */

function Tile({ label, value, sub, icon: I, from, to, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: typeof Users; from: string; to: string; href?: string }) {
  const body = (
    <>
      <I className="absolute -right-3 -top-3 size-20 opacity-15" />
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/85"><I className="size-4" /> {label}</div>
      <div className="mt-1 text-3xl font-black tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/85">{sub}</div>}
    </>
  );
  const cls = "relative block overflow-hidden rounded-2xl p-4 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg";
  const style = { backgroundImage: `linear-gradient(135deg, ${from}, ${to})` };
  return href ? <Link href={href} className={cls} style={style}>{body}</Link> : <div className={cls} style={style}>{body}</div>;
}

/** Bars by value (US$), with INR and the number of MoUs — each row in its own colour. */
function ValueBars({ rows, empty = "No MoUs yet.", flag, href, rank }: { rows: Agg[]; empty?: string; flag?: boolean; href?: (r: Agg) => string; rank?: boolean }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.usd), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700">
              {rank && <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: solid(i) }}>{i + 1}</span>}
              {flag && <Flag country={r.country ?? r.label} className="text-base" />}
              {href ? <Link href={href(r)} className="truncate font-medium hover:text-brand-700 hover:underline">{r.label}</Link> : <span className="truncate font-medium">{r.label}</span>}
              {r.sub && <span className="truncate font-mono text-[10px] text-slate-400">{r.sub}</span>}</span>
            <span className="shrink-0 text-right text-xs tabular-nums"><b className="text-ink">{both(r.usd, r.inr)}</b> <span className="text-slate-500">· {r.count} MoU{r.count === 1 ? "" : "s"}{r.tbd ? ` (${r.tbd} TBD)` : ""}</span></span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full" style={{ width: `${Math.max(2, (r.usd / max) * 100)}%`, backgroundImage: grad(i) }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Donut by value (or count) with a legend. */
function Donut({ rows, by = "usd", centre, sub }: { rows: { key: string; label: string; usd: number; count: number }[]; by?: "usd" | "count"; centre: React.ReactNode; sub: string }) {
  const total = rows.reduce((n, r) => n + r[by], 0);
  if (!total) return <p className="py-6 text-center text-sm text-slate-500">No MoUs yet.</p>;
  const ends = rows.map((_, i) => rows.slice(0, i + 1).reduce((n, r) => n + r[by], 0));
  const stops = rows.map((r, i) => `${solid(i)} ${((ends[i] - r[by]) / total) * 360}deg ${(ends[i] / total) * 360}deg`).join(", ");
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="relative size-40 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
          <div className="text-xl font-black text-ink">{centre}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">{sub}</div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5 text-xs">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: solid(i) }} />
            <span className="min-w-0 flex-1 truncate text-slate-700">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{by === "usd" ? shortUsd(r.usd) : r.count}</span>
            <span className="w-9 shrink-0 text-right tabular-nums text-slate-400">{Math.round((r[by] / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Columns({ rows, label, offset = 0 }: { rows: Agg[]; label: (k: string) => string; offset?: number }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">No MoUs yet.</p>;
  const max = Math.max(...rows.map((r) => r.usd), 1);
  return (
    <div className="flex h-52 items-end gap-2">
      {rows.map((r, i) => (
        <div key={r.key} className="group flex h-full min-w-0 flex-1 flex-col justify-end text-center" title={`${label(r.key)}: ${fmtUsd(r.usd)} · ${fmtInr(r.inr)} · ${r.count} MoUs`}>
          <div className="text-[10px] font-bold tabular-nums text-slate-700">{shortUsd(r.usd)}</div>
          <div className="rounded-t-lg opacity-90 transition group-hover:opacity-100" style={{ height: `${(r.usd / max) * 72}%`, minHeight: 4, backgroundImage: grad(i + offset, "180deg") }} />
          <div className="mt-1 truncate text-[10px] font-medium text-slate-600">{label(r.key)}</div>
          <div className="text-[10px] text-slate-400">{r.count} MoU{r.count === 1 ? "" : "s"}</div>
        </div>
      ))}
    </div>
  );
}

/** Recent MoUs as a feed that scrolls by itself (pauses under the mouse). */
function Feed({ rows, base, now }: { rows: Recent; base: string; now: number }) {
  if (!rows.length) return <p className="px-5 py-10 text-center text-sm text-slate-500">No MoUs yet. Buyers fill them from their login after a successful meeting.</p>;
  const scroll = rows.length > 5;
  const card = (m: Recent[number], copy: number) => (
    <li key={`${copy}-${m.id}`} aria-hidden={copy ? true : undefined} className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <Flag country={m.buyer.country} className="mt-0.5 text-2xl" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-bold text-ink">{m.buyer.name}</span>
          <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">{countryCode(m.buyer.country)}</span>
          {now - m.submittedAt.getTime() < 15 * 60000 && <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-300 px-1.5 text-[10px] font-extrabold text-yellow-950"><Sparkles className="size-3" /> NEW</span>}
        </div>
        <div className="text-xs text-slate-600">with <b className="font-semibold text-slate-800">{m.seller.name}</b> <span className="font-mono text-[10px] text-slate-400">{uid(m.seller)}</span> · {m.seller.district}</div>
        <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{m.goods}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          {copy ? <span className="font-mono font-bold text-brand-800">{m.mouNo}</span> : <Link href={`${base}/${m.id}`} className="font-mono font-bold text-brand-800 hover:underline">{m.mouNo}</Link>}
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", STATUS_CHIP[m.status])}>{mouStageShort(m)}</span>
          <span className="inline-flex items-center gap-1 text-slate-400"><Clock className="size-3" /> {ago(m.submittedAt, now)}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {m.money ? <><div className="text-base font-extrabold text-emerald-700">{shortUsd(m.money.usd)}</div><div className="text-xs font-semibold text-slate-500">{shortInr(m.money.inr)}</div></> : <div className="text-xs font-semibold text-slate-400">TBD</div>}
        <div className="mt-0.5 text-[10px] text-slate-400">order {fmtMonth(m.orderMonth)}</div>
      </div>
    </li>
  );
  return (
    <div className={cn("relative overflow-hidden bg-slate-50", scroll && "h-[600px]")}>
      {scroll && <><div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b from-slate-50 to-transparent" /><div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t from-slate-50 to-transparent" /></>}
      <ul className={cn("space-y-2 p-3", scroll && "tx-feed")} style={{ "--tx-dur": `${rows.length * 4}s` } as React.CSSProperties}>
        {rows.map((m) => card(m, 0))}{scroll && rows.map((m) => card(m, 1))}
      </ul>
    </div>
  );
}

/** Top countries as a leaderboard — flag, rank and share of value. */
function Leaderboard({ rows, base }: { rows: Agg[]; base: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">No MoUs yet.</p>;
  const total = rows.reduce((n, r) => n + r.usd, 0) || 1;
  const medal = ["from-yellow-300 to-amber-500", "from-slate-300 to-slate-500", "from-orange-300 to-orange-600"];
  return (
    <ol className="space-y-1">
      {rows.slice(0, 6).map((r, i) => (
        <li key={r.key}>
          <Link href={`${base}/list?country=${encodeURIComponent(r.key)}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">
            <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black", i < 3 ? `bg-linear-to-br ${medal[i]} text-white shadow` : "bg-slate-100 text-slate-500")}>{i + 1}</span>
            <Flag country={r.country ?? r.label} className="text-2xl" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-bold text-ink">{r.label}</span><span className="shrink-0 text-sm font-extrabold tabular-nums text-ink">{shortUsd(r.usd)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, (r.usd / total) * 100)}%`, backgroundImage: grad(i) }} /></div>
              <div className="mt-0.5 text-[11px] text-slate-500">{r.count} MoU{r.count === 1 ? "" : "s"} · {shortInr(r.inr)} · {Math.round((r.usd / total) * 100)}% of value</div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ page */

/** Live MoU dashboard (Directorate, FIEO, Admin) — also shown full screen at the venue. */
export async function MouDashboard({ user, base, scope }: { user: User; base: string; scope?: string }) {
  const sc = scope === "approved" ? "approved" : "signed";
  const s = await mouStats(sc);
  const t = s.totals;
  const now = s.now;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const scopeLabel = sc === "approved" ? "approved MoUs" : "MoUs signed (approved + awaiting verification)";
  const status = [
    { key: "a", label: "Approved", usd: t.approved.usd, count: t.approved.count },
    { key: "p", label: "Awaiting verification", usd: t.pending.usd, count: t.pending.count },
    { key: "r", label: "Returned to buyer", usd: 0, count: t.returned },
    { key: "w", label: "Withdrawn", usd: 0, count: t.withdrawn },
  ].filter((r) => r.count);
  return (
    <div id="mou-live">
      <PageHeader eyebrow="Memorandum of understanding" title="MoU dashboard"
        subtitle={<>Live position of MoUs signed after buyer–seller meetings. Breakdowns show {scopeLabel}. Values in US$ and INR at 1 US$ = ₹ {s.rate}.</>}
        actions={<div className="flex flex-wrap items-center gap-3"><AutoRefresh seconds={30} /><DisplayMode target="mou-live" /><span className="tx-hide-display"><DownloadButtons href="/api/reports/mou-register" label="MoU register" compact /></span></div>} />
      <div className="tx-hide-display mb-5 flex flex-wrap items-center gap-2 text-sm">
        <Link href={base} className={cn("rounded-lg px-3 py-1.5 font-semibold ring-1", sc === "signed" ? "bg-ink text-white ring-ink" : "bg-white text-slate-600 ring-slate-200")}>All signed</Link>
        <Link href={`${base}?scope=approved`} className={cn("rounded-lg px-3 py-1.5 font-semibold ring-1", sc === "approved" ? "bg-ink text-white ring-ink" : "bg-white text-slate-600 ring-slate-200")}>Approved only</Link>
        {user.role === "DIC" && <span className="ml-auto inline-flex items-center gap-2 text-xs text-slate-500">Exchange rate 1 US$ = ₹
          <InlineForm action={setMouRateAction} fields={{}} label="Set rate"><input name="rate" defaultValue={s.rate} inputMode="decimal" aria-label="Rupees per US dollar" className="w-20 rounded-lg border-0 px-2 py-1.5 text-sm ring-1 ring-slate-300" /></InlineForm></span>}
      </div>

      <Hero s={s} now={now} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Approved — total value" icon={BadgeCheck} from="#10b981" to="#047857" href={`${base}/list?status=APPROVED`}
          value={<CountUp value={t.approved.usd} kind="usd" />} sub={<>{fmtInr(t.approved.inr)} · {t.approved.count} MoUs{t.approved.tbd ? ` (${t.approved.tbd} TBD)` : ""}</>} />
        <Tile label="Awaiting verification" icon={Hourglass} from="#f59e0b" to="#ea580c" href={`${base}/list?status=SUBMITTED`}
          value={<CountUp value={t.pending.usd} kind="usd" />} sub={<>{fmtInr(t.pending.inr)} · {t.pending.count} MoUs</>} />
        <Tile label="All signed — value" icon={FileSignature} from="#0ea5e9" to="#1d4ed8"
          value={<CountUp value={t.signed.usd} kind="usd" />} sub={<>{fmtInr(t.signed.inr)} · {t.signed.count} MoUs</>} />
        <Tile label="Average MoU" icon={Trophy} from="#8b5cf6" to="#6d28d9"
          value={<CountUp value={t.avgUsd} kind="shortUsd" />} sub={<>{shortInr(t.avgUsd * s.rate)} · per MoU with a value</>} />
        <Tile label="Awaiting nodal officer" icon={ShieldCheck} from="#f97316" to="#c2410c" href={`${base}/list?stage=nodal`}
          value={<CountUp value={t.pending.awaitingNodal} />} sub={`${t.returned} returned · ${t.withdrawn} withdrawn`} />
        <Tile label="Awaiting FIEO" icon={Landmark} from="#06b6d4" to="#0e7490" href={`${base}/list?stage=fieo`}
          value={<CountUp value={t.pending.awaitingFieo} />} sub="Approval by the FIEO team" />
        <Tile label="Buyers / sellers with an MoU" icon={Users} from="#ec4899" to="#be185d"
          value={<>{t.buyers} <span className="text-xl text-white/70">/</span> {t.sellers}</>} sub={`${pct(t.buyers, t.approvedBuyers)} of buyers · ${pct(t.sellers, t.approvedSellers)} of sellers`} />
        <Tile label="Meetings → MoUs" icon={Handshake} from="#14b8a6" to="#0f766e"
          value={pct(t.withMeeting, t.meetingsDone || t.meetingsAll)}
          sub={`${t.withMeeting} MoU${t.withMeeting === 1 ? "" : "s"} from ${t.meetingsDone ? `${t.meetingsDone} meetings held` : `${t.meetingsAll} meetings scheduled`}`} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Recent MoUs" icon={<FileSignature className="size-4" />} subtitle="Newest first — scrolls by itself, refreshes every 30 seconds"
            action={<Link href={`${base}/list`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">All MoUs <ArrowRight className="size-4" /></Link>} />
          <Feed rows={s.recent} base={base} now={now} />
        </Card>
        <div className="space-y-6">
          <Card className="overflow-hidden"><CardHeader title="Top countries" icon={<Globe2 className="size-4" />} subtitle="By value of MoUs" /><div className="p-4"><Leaderboard rows={s.byCountry} base={base} /></div></Card>
          {s.biggest && (
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-amber-300 via-yellow-300 to-orange-400 p-5 text-amber-950 shadow-md">
              <Trophy className="absolute -right-4 -top-4 size-28 opacity-20" />
              <div className="text-[11px] font-black uppercase tracking-wider">Largest MoU</div>
              <div className="mt-1 text-3xl font-black">{fmtUsd(s.biggest.money!.usd)}</div>
              <div className="text-sm font-bold">{fmtInr(s.biggest.money!.inr)}</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm"><Flag country={s.biggest.buyer.country} className="text-lg" /> <b>{s.biggest.buyer.name}</b> ↔ {s.biggest.seller.name}</div>
              <div className="text-xs">{s.biggest.goods}</div>
              <Link href={`${base}/${s.biggest.id}`} className="mt-1 inline-block font-mono text-xs font-bold hover:underline">{s.biggest.mouNo}</Link>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.5fr_1fr_1fr]">
        <Card className="overflow-hidden"><CardHeader title="Share by sector" icon={<Handshake className="size-4" />} subtitle="By value" /><div className="p-5"><Donut rows={s.bySector} centre={shortUsd(s.bySector.reduce((n, r) => n + r.usd, 0))} sub="by value" /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="MoU status" icon={<BadgeCheck className="size-4" />} subtitle="Every MoU filled so far" /><div className="p-5"><Donut rows={status} by="count" centre={status.reduce((n, r) => n + r.count, 0)} sub="MoUs" /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="How values were entered" subtitle="US$, INR or to be determined" /><div className="p-5"><Donut rows={s.byCurrency} by="count" centre={s.byCurrency.reduce((n, r) => n + r.count, 0)} sub="MoUs" /></div></Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden"><CardHeader title="By buyer country" icon={<Globe2 className="size-4" />} /><div className="p-5"><ValueBars rows={s.byCountry} flag href={(r) => `${base}/list?country=${encodeURIComponent(r.key)}`} /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="By sector" icon={<Handshake className="size-4" />} /><div className="p-5"><ValueBars rows={s.bySector} href={(r) => `${base}/list?sector=${r.key}`} /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="Top buyers" subtitle="By value" /><div className="p-5"><ValueBars rows={s.byBuyer} flag rank /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="Top sellers" subtitle="By value" /><div className="p-5"><ValueBars rows={s.bySeller} rank /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="By seller district" icon={<Landmark className="size-4" />} /><div className="p-5"><ValueBars rows={s.byDistrict} href={(r) => `${base}/list?district=${encodeURIComponent(r.key)}`} /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="By nodal officer" subtitle="MoUs of the buyers each officer looks after" /><div className="p-5"><ValueBars rows={s.byNodal} /></div></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden"><CardHeader title="Order pipeline" subtitle="Value by the month buyers expect to place the order" /><div className="p-5"><Columns rows={s.byMonth} label={(k) => fmtMonth(k).replace(/ (\d{4})$/, " ’$1").replace("’20", "’")} /></div></Card>
        <Card className="overflow-hidden"><CardHeader title="MoUs signed by day" subtitle="Value of MoUs filled each day" /><div className="p-5"><Columns rows={s.byDay} label={(k) => k.slice(5)} offset={4} /></div></Card>
      </div>
      <p className="mt-4 text-xs text-slate-500">MoUs record the intention to order; values are the buyers&apos; approximate figures. Rupee and dollar values are converted at the rate above. {MOU_STATUS.APPROVED.label} = verified by the nodal officer and approved by FIEO.</p>
    </div>
  );
}
