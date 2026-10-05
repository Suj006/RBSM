import Link from "next/link";
import { CalendarClock, CheckCircle2, LayoutGrid, Rocket, Sparkles, UserCog, Users, Radio } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { allSlots, buyerPrimarySectors, daySlots, fmtDay, fmtTime, getEventConfig, unscheduledPairs } from "@/lib/event";
import { nodalAssignAction, pavilionAction, scheduleAction } from "@/app/actions/event";
import { fmtDateTime } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ActionButton } from "@/components/match/action-button";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { EventDatesForm, EventDaysForm, NodalForm } from "./forms";
import { InlineForm } from "./inline";
import { CountryTag, Flag, UidPill, uid } from "@/components/ids";
import { cn } from "@/lib/cn";

const inputCls = "w-20 rounded-lg border-0 px-2 py-1.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500";

function Step({ n, title, done, href, children, icon }: { n: number; title: string; done: boolean; href: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-4">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold", done ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500")}>
          {done ? <CheckCircle2 className="size-5" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-bold text-ink">{icon}{title}</h3>
            <Link href={href} className="text-sm font-semibold text-brand-700 hover:underline">Open →</Link>
          </div>
          <div className="mt-1.5 text-sm text-slate-600">{children}</div>
        </div>
      </div>
    </li>
  );
}

/** Event day set-up at a glance: the six steps from dates to the live event. */
export async function EventOverview({ user, base }: { user: User; base: string }) {
  const cfg = await getEventConfig();
  const [buyers, withPav, officers, withNodal, pairs, draft, published, unsched] = await Promise.all([
    prisma.buyer.count({ where: { status: "APPROVED" } }), prisma.buyer.count({ where: { status: "APPROVED", pavilionNo: { not: null } } }),
    prisma.nodalOfficer.count(), prisma.buyer.count({ where: { status: "APPROVED", nodalOfficerId: { not: null } } }),
    prisma.publishedMatch.count(), prisma.meeting.count(), prisma.scheduledMeeting.count(), unscheduledPairs(),
  ]);
  const slots = allSlots(cfg);
  const dic = user.role === "DIC";
  return (
    <>
      <PageHeader eyebrow="Event days" title="Meeting schedule & event day"
        subtitle="Set the event dates and hours, seat buyers in pavilions, assign nodal officers, build and publish the clash-free meeting schedule, then follow the event live." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Event days" value={cfg.days.length} accent="blue" hint={cfg.days.length ? `${fmtDay(cfg.days[0].date)} – ${fmtDay(cfg.days.at(-1)!.date)}` : "Not set"} />
        <StatCard label="Meeting slots" value={slots.length} accent="violet" hint={`${cfg.meetingMinutes} min + ${cfg.bufferMinutes} min buffer`} />
        <StatCard label="Meetings to schedule" value={`${draft} / ${pairs}`} accent="green" hint={unsched.length ? `${unsched.length} not scheduled yet` : pairs ? "All pairs placed" : "Publish the mapping first"} />
        <StatCard label="Published schedule" value={cfg.version ? `v${cfg.version}` : "—"} accent="yellow" hint={cfg.publishedAt ? `${published} meetings · ${fmtDateTime(cfg.publishedAt)}` : "Not published"} />
      </div>
      <ol className="space-y-4">
        <Step n={1} title="Event dates, hours and breaks" done={slots.length > 0} href={`${base}/settings`} icon={<CalendarClock className="size-4 text-brand-700" />}>
          {cfg.days.length ? <>{cfg.days.map((d) => `Day ${d.n}: ${fmtDay(d.date)}, ${d.startTime}–${d.endTime} (${daySlots(d, cfg).length} slots)`).join(" · ")}</> : "Set the start and end dates (two days planned), each day's hours and breaks."}
        </Step>
        <Step n={2} title="Pavilions" done={buyers > 0 && withPav === buyers} href={`${base}/pavilions`} icon={<LayoutGrid className="size-4 text-brand-700" />}>
          {withPav} of {buyers} approved buyers have a pavilion. Buyers are seated together by their first sector (in the sector master&apos;s order).
          {dic && <div className="mt-3"><ActionButton action={pavilionAction} fields={{ op: "auto" }} label={<><Sparkles className="size-4" /> {withPav ? "Re-allocate pavilions by sector" : "Allocate pavilions by sector"}</>}
            confirm={withPav ? "Re-number all pavilions by sector? Manual changes are replaced." : undefined} /></div>}
        </Step>
        <Step n={3} title="Nodal officers" done={officers > 0 && withNodal === buyers} href={`${base}/nodal`} icon={<UserCog className="size-4 text-brand-700" />}>
          {officers} nodal officer{officers === 1 ? "" : "s"}; {withNodal} of {buyers} buyers assigned{officers ? ` (about ${Math.ceil(buyers / officers)} each)` : ""}.
        </Step>
        <Step n={4} title="Draft schedule" done={pairs > 0 && !unsched.length && draft > 0} href={`${base}/schedule`} icon={<Users className="size-4 text-brand-700" />}>
          Each buyer–seller pair of the published mapping gets a {cfg.meetingMinutes}-minute slot with a {cfg.bufferMinutes}-minute buffer; no buyer or seller is double-booked. Visible only to the Directorate, FIEO and Admin; editable.
          {dic && slots.length > 0 && pairs > 0 && <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton action={scheduleAction} fields={{ op: "fill" }} variant="primary" label={<><Sparkles className="size-4" /> {draft ? "Fill gaps" : "Generate the schedule"}</>} />
            {draft > 0 && <ActionButton action={scheduleAction} fields={{ op: "rebuild" }} label="Rebuild (keep manual changes)" confirm="Rebuild the draft? Automatic placements are recomputed; meetings you placed or moved are kept." />}
          </div>}
        </Step>
        <Step n={5} title="Publish the schedule" done={cfg.version > 0} href={`${base}/published`} icon={<Rocket className="size-4 text-brand-700" />}>
          Publishing shows each buyer and seller their meetings with tickets; nodal officers see their buyers&apos; schedules. You can change the draft and republish; participants whose meetings change are e-mailed.
          {dic && draft > 0 && <div className="mt-3"><ActionButton action={scheduleAction} fields={{ op: "publish" }} variant="success"
            label={<><Rocket className="size-4" /> {cfg.version ? "Republish schedule" : "Publish schedule"}</>}
            confirm={`${cfg.version ? "Republish" : "Publish"} ${draft} meetings?${unsched.length ? ` ${unsched.length} pairs are not scheduled.` : ""} Buyers and sellers will see their schedule and tickets.`} /></div>}
        </Step>
        <Step n={6} title="Event day — live monitor" done={false} href={`${base}/live`} icon={<Radio className="size-4 text-brand-700" />}>
          Real-time view of every pavilion and slot: meetings completed, in progress and pending, idle buyers, no-shows and nodal officers&apos; marking.
        </Step>
      </ol>
    </>
  );
}

export async function EventSettings({ user }: { user: User }) {
  const cfg = await getEventConfig();
  const dic = user.role === "DIC";
  const slots = allSlots(cfg);
  return (
    <>
      <PageHeader eyebrow="Event days" title="Event dates, hours and breaks"
        subtitle={`Each meeting is ${cfg.meetingMinutes} minutes followed by a ${cfg.bufferMinutes}-minute buffer; slots never run into a break or past the end of the day.`} />
      {!dic && <Alert tone="slate" className="mb-6">Set by the Directorate. View only.</Alert>}
      <Card className="mb-6 p-6"><EventDatesForm start={cfg.days[0]?.date ?? ""} end={cfg.days.at(-1)?.date ?? ""} disabled={!dic} /></Card>
      {cfg.days.length > 0 && (
        <Card className="mb-6 p-6">
          <EventDaysForm disabled={!dic} meetingMinutes={cfg.meetingMinutes} bufferMinutes={cfg.bufferMinutes} venue={cfg.venue}
            days={cfg.days.map((d) => ({ date: d.date, label: `Day ${d.n} — ${fmtDay(d.date)}`, startTime: d.startTime, endTime: d.endTime, breaks: d.breaks }))} />
        </Card>
      )}
      {cfg.days.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title={`Meeting slots (${slots.length})`} subtitle="Every buyer can meet at most one seller per slot" />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {cfg.days.map((d) => (
              <div key={d.date}>
                <div className="mb-2 text-sm font-bold text-ink">Day {d.n} · {fmtDay(d.date)}</div>
                <div className="flex flex-wrap gap-1.5">
                  {daySlots(d, cfg).map((s) => <span key={s.no} className="rounded-md bg-slate-50 px-2 py-1 text-xs tabular-nums ring-1 ring-slate-200">{fmtTime(s.startAt)}</span>)}
                </div>
                {d.breaks.length > 0 && <div className="mt-2 text-xs text-slate-500">{d.breaks.map((b) => `${b.label} ${b.start}–${b.end}`).join(" · ")}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

export async function PavilionsPage({ user }: { user: User }) {
  const dic = user.role === "DIC";
  const [list, matched] = await Promise.all([buyerPrimarySectors(), prisma.publishedMatch.groupBy({ by: ["buyerId"], _count: true })]);
  const rows = list.sort((a, b) => (a.pavilionNo ?? 9999) - (b.pavilionNo ?? 9999) || (a.approvedSeq ?? 0) - (b.approvedSeq ?? 0));
  const groups = new Map<string, number[]>();
  for (const r of rows) if (r.pavilionNo) { const k = r.primary?.name ?? "No sector"; groups.set(k, [...(groups.get(k) ?? []), r.pavilionNo]); }
  return (
    <>
      <PageHeader eyebrow="Event days" title="Pavilions"
        subtitle="Each approved buyer sits at a pavilion; sellers come to it. Buyers are grouped by their first sector that has matched sellers (else their first sector), in the sector master's order."
        actions={<div className="flex flex-wrap gap-2">
          {dic && <ActionButton action={pavilionAction} fields={{ op: "auto" }} variant="primary" label="Allocate by sector" confirm="Re-number all pavilions by sector? Manual changes are replaced." />}
          <DownloadButtons href="/api/reports/event-schedule" label="Pavilion & schedule list" compact />
        </div>} />
      {groups.size > 0 && (
        <Card className="mb-6 p-5">
          <div className="mb-2 text-sm font-bold text-ink">Pavilions by sector</div>
          <div className="flex flex-wrap gap-2">
            {[...groups.entries()].map(([k, v]) => <Badge key={k} tone="blue">{k}: {Math.min(...v)}{v.length > 1 ? `–${Math.max(...v)}` : ""}</Badge>)}
          </div>
        </Card>
      )}
      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">Pavilion</th><th className="px-3 py-2.5 text-left">Buyer</th><th className="px-3 py-2.5 text-left">Seated by sector</th>
                  <th className="px-3 py-2.5 text-left">All approved sectors</th><th className="px-3 py-2.5 text-right">Matched sellers</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      {dic ? <InlineForm action={pavilionAction} fields={{ op: "set", buyerId: r.id }}>
                        <input name="pavilionNo" type="number" min={1} max={999} defaultValue={r.pavilionNo ?? ""} aria-label={`Pavilion for ${r.name}`} className={inputCls} />
                      </InlineForm> : <span className="font-bold tabular-nums">{r.pavilionNo ?? "—"}</span>}
                    </td>
                    <td className="px-3 py-2"><div className="flex items-center gap-1.5 font-semibold text-ink"><Flag country={r.country} /> {r.name}</div><div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><UidPill id={uid(r)} tone="buyer" /> <CountryTag country={r.country} name flag={false} /></div></td>
                    <td className="px-3 py-2">{r.primary ? <Badge tone="blue">{r.primary.name}</Badge> : "—"}</td>
                    <td className="max-w-72 px-3 py-2 text-xs text-slate-600">{(r.requirement?.items ?? []).map((i) => i.sector.name).join(", ")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{matched.find((m) => m.buyerId === r.id)?._count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<LayoutGrid className="size-5" />} title="No approved buyers yet" />}
      </Card>
    </>
  );
}

export async function NodalPage({ user }: { user: User }) {
  const dic = user.role === "DIC";
  const [officers, buyers] = await Promise.all([
    prisma.nodalOfficer.findMany({ orderBy: { createdAt: "asc" }, include: { user: { select: { username: true, lastLoginAt: true } }, buyers: { select: { pavilionNo: true } } } }),
    prisma.buyer.findMany({ where: { status: "APPROVED" }, orderBy: [{ pavilionNo: "asc" }, { approvedSeq: "asc" }], select: { id: true, name: true, country: true, approvedNo: true, regNo: true, pavilionNo: true, nodalOfficerId: true } }),
  ]);
  const range = (ps: (number | null)[]) => { const v = ps.filter((x): x is number => x !== null); return v.length ? `${Math.min(...v)}–${Math.max(...v)}` : "—"; };
  return (
    <>
      <PageHeader eyebrow="Event days" title="Nodal officers"
        subtitle="Directorate officers who look after a group of buyers on the event days: they see their buyers' schedules, verify sellers' tickets and mark attendance from their own login."
        actions={dic ? <ActionButton action={nodalAssignAction} fields={{ op: "auto" }} variant="primary" label="Share buyers among officers" confirm="Share all buyers among the nodal officers in pavilion order? Manual assignments are replaced." /> : undefined} />
      {dic && <Card className="mb-6"><CardHeader title="Add a nodal officer" subtitle="A login (nodal01, nodal02 …) is created and e-mailed; the password is changed at first sign-in." /><div className="p-6"><NodalForm /></div></Card>}
      <Card className="mb-6 overflow-hidden">
        <CardHeader title={`Officers (${officers.length})`} />
        {officers.length ? (
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 text-left">Officer</th><th className="px-3 py-2.5 text-left">Login</th><th className="px-3 py-2.5 text-left">Contact</th>
                  <th className="px-3 py-2.5 text-right">Buyers</th><th className="px-3 py-2.5 text-left">Pavilions</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {officers.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2"><div className="font-semibold text-ink">{o.name}</div><div className="text-xs text-slate-500">{o.designation}</div></td>
                    <td className="px-3 py-2 font-mono text-xs">{o.user.username}<div className="font-sans text-slate-400">{o.user.lastLoginAt ? `Last login ${fmtDateTime(o.user.lastLoginAt)}` : "Not signed in yet"}</div></td>
                    <td className="px-3 py-2 text-xs">{fmtMobile(o.mobile)}<div className="text-slate-500">{o.email}</div></td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{o.buyers.length}</td>
                    <td className="px-3 py-2 tabular-nums">{range(o.buyers.map((b) => b.pavilionNo))}</td>
                    <td className="px-3 py-2 text-right">{dic && <ActionButton action={nodalAssignAction} fields={{ op: "remove", officerId: o.id }} compact variant="ghost" label="Remove" confirm={`Remove ${o.name}? Their login is deactivated and their buyers unassigned.`} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="p-6 text-sm text-slate-500">No nodal officers yet.</p>}
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title="Buyers and their nodal officer" subtitle="Change any buyer's officer here" />
        <div className="table-scroll relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 text-left">Pavilion</th><th className="px-3 py-2.5 text-left">Buyer</th><th className="px-3 py-2.5 text-left">Nodal officer</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buyers.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 font-bold tabular-nums">{b.pavilionNo ?? "—"}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1.5 font-semibold text-ink"><Flag country={b.country} /> {b.name}</div><div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><UidPill id={uid(b)} tone="buyer" /> <CountryTag country={b.country} name flag={false} /></div></td>
                  <td className="px-3 py-2">
                    {dic ? <InlineForm action={nodalAssignAction} fields={{ op: "set", buyerId: b.id }}>
                      <select name="officerId" defaultValue={b.nodalOfficerId ?? ""} aria-label={`Nodal officer for ${b.name}`} className="rounded-lg border-0 py-1.5 pl-2 pr-8 text-sm ring-1 ring-slate-300">
                        <option value="">Not assigned</option>
                        {officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </InlineForm> : officers.find((o) => o.id === b.nodalOfficerId)?.name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
