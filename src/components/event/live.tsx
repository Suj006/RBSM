import Link from "next/link";
import { AlarmClock, ArrowLeftRight, CalendarX2, Radio } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canFill, daySlots, fmtDay, fmtTime, getEventConfig, istAt, istDay, isTime, LIVE_META, liveStatus, type Live } from "@/lib/event";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { AutoRefresh } from "./auto-refresh";
import { DayTabs } from "./schedule";
import { cn } from "@/lib/cn";
import { countryCode } from "@/lib/country-codes";
import { Flag, UidPill, uid } from "@/components/ids";

function Kpi({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone: string }) {
  return (
    <div className={cn("rounded-2xl p-4 ring-1", tone)}>
      <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs opacity-80">{sub}</div>}
    </div>
  );
}

/** Real-time picture of an event day: every pavilion and slot, who is meeting whom now, and what needs attention. */
export async function LiveMonitor({ user, base, day: dayParam, at }: { user: User; base: string; day?: string; at?: string }) {
  const cfg = await getEventConfig();
  const today = istDay();
  const day = cfg.days.find((d) => d.date === dayParam)?.date ?? cfg.days.find((d) => d.date === today)?.date ?? cfg.days[0]?.date ?? "";
  const rehearsal = !!at && isTime(at);
  const now = rehearsal ? istAt(day, at!) : new Date();
  const d = cfg.days.find((x) => x.date === day);
  if (!cfg.version || !d) {
    return (
      <>
        <PageHeader eyebrow="Event day" title="Live monitor" />
        <Card><EmptyState icon={<CalendarX2 className="size-5" />} title="Nothing to monitor yet">The live monitor starts once the meeting schedule is published.</EmptyState></Card>
      </>
    );
  }
  const [meetings, attendance] = await Promise.all([
    prisma.scheduledMeeting.findMany({ where: { day }, orderBy: [{ startAt: "asc" }],
      include: { buyer: { select: { id: true, name: true, country: true, approvedNo: true, regNo: true, pavilionNo: true, nodalOfficer: { select: { id: true, name: true, mobile: true } } } }, seller: { select: { id: true, name: true, district: true, approvedNo: true, regNo: true } }, movedBy: { select: { displayName: true, role: true } } } }),
    prisma.buyerDayAttendance.findMany({ where: { day } }),
  ]);
  const slots = daySlots(d, cfg);
  const st = meetings.map((m) => ({ m, s: liveStatus(m, now) }));
  const count = (...k: Live[]) => st.filter((x) => k.includes(x.s)).length;
  const active = st.filter((x) => x.s !== "cancelled");
  const current = slots.find((s) => now >= s.startAt && now < new Date(s.endAt.getTime() + cfg.bufferMinutes * 60000));
  const next = slots.find((s) => s.startAt > now);
  const dayStart = slots[0]?.startAt, dayEnd = slots.at(-1)?.endAt;
  const phase = !dayStart ? "" : now < dayStart ? "Before the first meeting" : now >= dayEnd! ? "Meetings over for the day" : current ? `Slot ${current.no}: ${fmtTime(current.startAt)}–${fmtTime(current.endAt)}${now >= current.endAt ? " (buffer — sellers moving)" : ""}` : "Break";

  // Buyers
  const buyerIds = [...new Set(meetings.map((m) => m.buyerId))];
  const buyers = buyerIds.map((id) => meetings.find((m) => m.buyerId === id)!.buyer).sort((a, b) => (a.pavilionNo ?? 999) - (b.pavilionNo ?? 999));
  const absent = new Set(attendance.filter((a) => !a.present).map((a) => a.buyerId));
  const buyerNow = (id: string) => {
    const mine = st.filter((x) => x.m.buyerId === id);
    if (absent.has(id)) return "absent";
    if (mine.some((x) => x.s === "in_meeting")) return "meeting";
    if (mine.some((x) => x.s === "awaiting")) return "waiting";
    if (mine.some((x) => x.s === "upcoming" || x.s === "checked_in")) return "idle";
    return "done";
  };
  const bState = buyers.map((b) => ({ b, s: buyerNow(b.id) }));
  const bc = (s: string) => bState.filter((x) => x.s === s).length;
  // Sellers
  const sellerIds = [...new Set(meetings.map((m) => m.sellerId))];
  const sellerNow = (id: string) => {
    const mine = st.filter((x) => x.m.sellerId === id);
    if (mine.some((x) => x.s === "in_meeting")) return "meeting";
    if (mine.some((x) => ["upcoming", "checked_in", "awaiting"].includes(x.s))) return "pending";
    return "done";
  };
  const sc = (s: string) => sellerIds.filter((id) => sellerNow(id) === s).length;
  const sellerPendingMeetings = count("upcoming", "checked_in", "awaiting");
  const concluded = count("completed", "no_show", "buyer_absent", "not_marked");
  const pct = active.length ? Math.round((concluded / active.length) * 100) : 0;

  // Attention: meetings running without a checked-in seller; past meetings not marked
  const late = st.filter((x) => x.s === "awaiting" || (x.s === "no_show" && canFill(x.m, now) && !st.some((y) => y.m.replacesId === x.m.id && y.m.startAt.getTime() === x.m.startAt.getTime())));
  const canAct = user.role === "DIC" && !rehearsal;
  const unmarked = st.filter((x) => x.s === "not_marked");
  // Event-day changes: slots given to another seller, meetings moved for late sellers.
  const changes = meetings.filter((m) => m.movedAt).sort((a, b) => b.movedAt!.getTime() - a.movedAt!.getTime());
  const changeText = (m: (typeof meetings)[number]) => {
    const was = m.replacesId ? meetings.find((x) => x.id === m.replacesId) : null;
    return `${was ? `took ${was.seller.name}'s slot (absent); ` : ""}${m.movedFrom ? `moved from ${fmtTime(m.movedFrom)}` : "new meeting"}${m.movedBy ? ` — ${m.movedBy.displayName}` : ""}`;
  };
  // Nodal officers
  const officers = new Map<string, { name: string; mobile: string; buyers: Set<string>; due: number; marked: number; inMeeting: number }>();
  for (const { m, s } of st) {
    const o = m.buyer.nodalOfficer; const k = o?.id ?? "none";
    const e = officers.get(k) ?? { name: o?.name ?? "Not assigned", mobile: o?.mobile ?? "", buyers: new Set<string>(), due: 0, marked: 0, inMeeting: 0 };
    e.buyers.add(m.buyerId);
    if (now >= m.startAt) { e.due++; if (m.status !== "SCHEDULED") e.marked++; }
    if (s === "in_meeting") e.inMeeting++;
    officers.set(k, e);
  }
  // A filled slot shows the seller who took it, not the absent one.
  const at2 = (b: string, t: Date) => { const all = st.filter((x) => x.m.buyerId === b && x.m.startAt.getTime() === t.getTime()); return all.find((x) => x.s !== "no_show") ?? all[0]; };
  const q = (extra: Record<string, string>) => `${base}/live?${new URLSearchParams({ day, ...(rehearsal ? { at: at! } : {}), ...extra })}`;

  return (
    <>
      <PageHeader eyebrow="Event day" title="Live monitor"
        subtitle={<>Day {d.n} · {fmtDay(day)} · <b className="text-ink">{rehearsal ? `Rehearsal at ${at}` : `Now ${fmtTime(now)}`}</b> · {phase}</>}
        actions={<div className="flex flex-wrap items-center gap-3">{!rehearsal && day === today && <AutoRefresh />}<DownloadButtons href="/api/reports/event-attendance" label="Attendance" compact /></div>} />
      <DayTabs cfg={cfg} day={day} href={(x) => `${base}/live?day=${x}${rehearsal ? `&at=${at}` : ""}`} />
      <form action={`${base}/live`} className="no-print mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <input type="hidden" name="day" value={day} />
        <span>Rehearsal — view the board as at</span>
        <input name="at" type="time" defaultValue={rehearsal ? at : ""} className="rounded-lg border-0 px-2 py-1.5 ring-1 ring-slate-300" aria-label="Time" />
        <button className="rounded-lg px-3 py-1.5 font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">Show</button>
        {rehearsal && <Link href={`${base}/live?day=${day}`} className="font-semibold text-brand-700 hover:underline">Back to live</Link>}
      </form>

      <div className="mb-3 h-3 overflow-hidden rounded-full bg-slate-100" title={`${pct}% of today's meetings concluded`}>
        <div className="h-3 rounded-full bg-tx-green" style={{ width: `${pct}%` }} />
      </div>
      <div className="mb-6 text-xs text-slate-500">{concluded} of {active.length} meetings concluded ({pct}%) · {count("cancelled")} cancelled</div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Meetings today" value={active.length} tone="bg-white text-ink ring-slate-200" sub={`${slots.length} slots · ${buyers.length} pavilions`} />
        <Kpi label="Completed" value={count("completed")} tone="bg-brand-50 text-brand-900 ring-brand-200" />
        <Kpi label="In meeting now" value={count("in_meeting")} tone="bg-brand-600 text-white ring-brand-700" />
        <Kpi label="Awaiting seller now" value={count("awaiting")} tone="bg-amber-50 text-amber-900 ring-amber-300" sub="Slot started, seller not checked in" />
        <Kpi label="Upcoming" value={count("upcoming", "checked_in")} tone="bg-slate-50 text-slate-800 ring-slate-200" sub={next ? `Next slot ${fmtTime(next.startAt)}` : "No more slots"} />
        <Kpi label="No-shows" value={count("no_show", "buyer_absent")} tone="bg-red-50 text-red-800 ring-red-200" sub={`${count("no_show")} seller · ${count("buyer_absent")} buyer · ${count("not_marked")} not marked · ${changes.filter((c) => c.replacesId).length} slots filled`} />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Buyers now</div>
          <div className="mt-2 grid grid-cols-5 gap-2 text-center text-xs">
            {[["meeting", "In meeting", "text-brand-700"], ["waiting", "Waiting", "text-amber-700"], ["idle", "Idle", "text-slate-700"], ["done", "Done", "text-slate-400"], ["absent", "Absent", "text-tx-red"]].map(([k, l, c]) =>
              <div key={k}><div className={cn("text-2xl font-extrabold tabular-nums", c)}>{bc(k)}</div>{l}</div>)}
          </div></Card>
        <Card className="p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Sellers now</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            {[["meeting", "In meeting", "text-brand-700"], ["pending", "Meetings pending", "text-amber-700"], ["done", "Finished", "text-slate-400"]].map(([k, l, c]) =>
              <div key={k}><div className={cn("text-2xl font-extrabold tabular-nums", c)}>{sc(k)}</div>{l}</div>)}
          </div></Card>
        <Card className="p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Seller meetings pending today</div>
          <div className="mt-2 text-3xl font-extrabold tabular-nums text-ink">{sellerPendingMeetings}</div><div className="text-xs text-slate-500">across {sc("pending")} sellers</div></Card>
        <Card className="p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Marking by nodal officers</div>
          <div className="mt-2 text-3xl font-extrabold tabular-nums text-ink">{[...officers.values()].reduce((a, o) => a + o.marked, 0)} / {[...officers.values()].reduce((a, o) => a + o.due, 0)}</div><div className="text-xs text-slate-500">meetings due so far that are marked</div></Card>
      </div>

      <div className="grid items-start gap-6 2xl:grid-cols-[1fr_360px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Pavilion board" icon={<Radio className="size-4" />} subtitle="Every pavilion and slot — colour shows the live status; the current slot is outlined" />
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3 text-[11px]">
            {(Object.keys(LIVE_META) as Live[]).map((k) => <span key={k} className={cn("rounded-md px-2 py-0.5 ring-1", LIVE_META[k].tone)}>{LIVE_META[k].label}</span>)}
            <span className="rounded-md px-2 py-0.5 outline-2 outline-dashed outline-amber-500"><b className="text-amber-600">⇄</b> Changed on the day</span>
          </div>
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-[11px]">
              <thead>
                <tr className="bg-slate-50 font-semibold uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-10 min-w-72 bg-slate-50 px-3 py-2 text-left">Pavilion · buyer · ID</th>
                  {slots.map((s) => <th key={s.no} className={cn("min-w-24 px-1 py-2 text-center tabular-nums", current?.no === s.no && "bg-brand-100 text-brand-900")}>{fmtTime(s.startAt)}</th>)}
                </tr>
              </thead>
              <tbody>
                {bState.map(({ b, s }) => (
                  <tr key={b.id}>
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-1">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-7 shrink-0 rounded bg-ink text-center font-bold text-white tabular-nums">{b.pavilionNo ?? "–"}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5"><span className="truncate font-semibold text-ink">{b.name}</span>
                            <span className={cn("shrink-0 rounded px-1 text-[10px] font-bold uppercase", s === "meeting" ? "bg-brand-600 text-white" : s === "waiting" ? "bg-amber-200 text-amber-900" : s === "absent" ? "bg-red-100 text-red-700" : s === "idle" ? "bg-slate-100 text-slate-600" : "text-slate-400")}>{s === "meeting" ? "in meeting" : s}</span></div>
                          <div className="flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-500"><Flag country={b.country} /> <b>{countryCode(b.country)}</b> <span className="font-mono">{uid(b)}</span></div>
                        </div>
                      </div>
                    </td>
                    {slots.map((sl) => {
                      const x = at2(b.id, sl.startAt);
                      return (
                        <td key={sl.no} className={cn("border-b border-l border-slate-100 p-0.5", current?.no === sl.no && "bg-brand-50/60")}>
                          {x ? <span title={`${x.m.seller.name} · ${uid(x.m.seller)} (${x.m.seller.district}) · ${x.m.ticketNo} · ${LIVE_META[x.s].label}${x.m.movedAt ? ` · CHANGED ON THE DAY: ${changeText(x.m)}` : ""}`}
                            className={cn("block truncate rounded px-1 py-1 font-medium ring-1", LIVE_META[x.s].tone, x.m.movedAt && "outline-2 outline-offset-1 outline-amber-500 outline-dashed")}>
                            {x.m.movedAt && <span className="mr-0.5 font-bold text-amber-600" aria-label="changed on the day">⇄</span>}{x.m.seller.name}</span> : <span className="block h-6" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title={`Needs attention now (${late.length})`} icon={<AlarmClock className="size-4" />} subtitle={canAct ? "Seller not checked in or absent — the slot can be given to another matched seller" : "Slot started — seller not checked in, or absent"} />
            {late.length ? <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {late.map(({ m }) => (
                <li key={m.id} className="px-5 py-2.5 text-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-ink">P{m.buyer.pavilionNo ?? "–"} <Flag country={m.buyer.country} /> {m.buyer.name} <UidPill id={uid(m.buyer)} tone="buyer" /></div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">{m.seller.name} <UidPill id={uid(m.seller)} tone="seller" /> · {fmtTime(m.startAt)} · {m.ticketNo}</div>
                  <div className="text-xs text-slate-500">{m.status === "SELLER_ABSENT" ? <b className="text-tx-red">Seller absent · </b> : ""}Nodal: {m.buyer.nodalOfficer?.name ?? "not assigned"}{m.buyer.nodalOfficer?.mobile ? ` · ${m.buyer.nodalOfficer.mobile}` : ""}</div>
                  {canAct && <Link href={`${base}/live/slot/${m.id}`} className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline">Fill this slot →</Link>}
                </li>
              ))}
            </ul> : <p className="px-5 py-4 text-sm text-slate-500">Nothing late.</p>}
          </Card>
          <Card className={cn("overflow-hidden", changes.length > 0 && "ring-2 ring-amber-300")}>
            <CardHeader title={`Event-day changes (${changes.length})`} icon={<ArrowLeftRight className="size-4" />} subtitle="Slots given to another seller and meetings moved, newest first" />
            {changes.length ? <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {changes.map((m) => {
                const was = m.replacesId ? meetings.find((x) => x.id === m.replacesId) : null;
                return (
                  <li key={m.id} className="px-5 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5 font-semibold text-ink"><span className="rounded bg-ink px-1.5 text-xs text-white tabular-nums">P{m.pavilionNo ?? "–"}</span> {fmtTime(m.startAt)} · <Flag country={m.buyer.country} /> {m.buyer.name}</div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {was ? <><span className="text-tx-red line-through">{was.seller.name}</span> absent → <b className="text-ink">{m.seller.name}</b> <span className="font-mono">{uid(m.seller)}</span></>
                        : <><b className="text-ink">{m.seller.name}</b> <span className="font-mono">{uid(m.seller)}</span> (late arrival)</>}
                    </div>
                    <div className="text-xs text-slate-500">{m.movedFrom ? `Moved from ${fmtTime(m.movedFrom)}` : "New meeting"} · {m.movedBy ? `${m.movedBy.displayName} (${m.movedBy.role === "NODAL" ? "nodal officer" : "Directorate"})` : ""} · {fmtTime(m.movedAt!)}</div>
                  </li>
                );
              })}
            </ul> : <p className="px-5 py-4 text-sm text-slate-500">No changes today.</p>}
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Nodal officers" subtitle="Meetings due so far / marked" />
            <ul className="divide-y divide-slate-100">
              {[...officers.entries()].map(([k, o]) => (
                <li key={k} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <div><div className="font-semibold text-ink">{o.name}</div><div className="text-xs text-slate-500">{o.buyers.size} buyers · {o.inMeeting} in meeting now</div></div>
                  <Badge tone={o.due && o.marked < o.due ? "amber" : "green"}>{o.marked} / {o.due}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          {unmarked.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title={`Past meetings not marked (${unmarked.length})`} />
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {unmarked.map(({ m }) => <li key={m.id} className="px-5 py-2 text-xs"><b className="text-ink">P{m.buyer.pavilionNo ?? "–"}</b> {m.seller.name} <span className="font-mono">{uid(m.seller)}</span> · {fmtTime(m.startAt)} · {m.buyer.nodalOfficer?.name ?? "no nodal officer"}</li>)}
              </ul>
            </Card>
          )}
          <p className="text-xs text-slate-500">Statuses come from the nodal officers&apos; ticket checks: a meeting is <b>in progress</b> when its slot is running and the seller is checked in; it counts as <b>completed</b> once its slot ends (or is marked completed). <Link href={q({})} className="font-semibold text-brand-700">Refresh</Link></p>
        </div>
      </div>
    </>
  );
}
