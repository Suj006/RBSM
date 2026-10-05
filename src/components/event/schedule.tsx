import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarX2, Rocket, Sparkles, Trash2 } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { allSlots, daySlots, fmtDay, fmtTime, freeSlotsFor, getEventConfig, unscheduledPairs, type EventConfig } from "@/lib/event";
import { meetingEditAction, scheduleAction } from "@/app/actions/event";
import { fmtDateTime } from "@/lib/format";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ActionButton } from "@/components/match/action-button";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { cn } from "@/lib/cn";
import { countryCode } from "@/lib/country-codes";
import { Flag, UidPill, uid } from "@/components/ids";

type GridMeeting = { id: string; buyerId: string; sellerId: string; startAt: Date; seller: { name: string; approvedNo: string | null; regNo: string }; ticketNo?: string };
type GridBuyer = { id: string; name: string; pavilionNo: number | null; country: string; approvedNo: string | null; regNo: string };

export function DayTabs({ cfg, day, href }: { cfg: EventConfig; day: string; href: (d: string) => string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {cfg.days.map((d) => (
        <Link key={d.date} href={href(d.date)} aria-current={d.date === day ? "page" : undefined}
          className={cn("rounded-lg px-3.5 py-2 text-sm font-semibold ring-1", d.date === day ? "bg-ink text-white ring-ink" : "bg-white text-slate-600 ring-slate-200 hover:text-ink")}>
          Day {d.n} · {fmtDay(d.date)}
        </Link>
      ))}
    </div>
  );
}

/** Pavilion × slot grid for one day. Cells link to `cellHref` (editing) when given. */
export function ScheduleGrid({ cfg, day, buyers, meetings, cellHref }: {
  cfg: EventConfig; day: string; buyers: GridBuyer[]; meetings: GridMeeting[]; cellHref?: (m: GridMeeting) => string;
}) {
  const d = cfg.days.find((x) => x.date === day);
  if (!d) return null;
  const slots = daySlots(d, cfg);
  const at = new Map(meetings.map((m) => [`${m.buyerId}|${m.startAt.getTime()}`, m]));
  return (
    <div className="table-scroll relative overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="sticky left-0 z-10 min-w-72 bg-slate-50 px-3 py-2 text-left">Pavilion · buyer · ID</th>
            {slots.map((s) => <th key={s.no} className="min-w-28 px-1.5 py-2 text-center tabular-nums">{fmtTime(s.startAt)}</th>)}
          </tr>
        </thead>
        <tbody>
          {buyers.map((b) => (
            <tr key={b.id}>
              <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-8 shrink-0 rounded bg-ink text-center font-bold text-white tabular-nums">{b.pavilionNo ?? "–"}</span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{b.name}</div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><Flag country={b.country} /> <b>{countryCode(b.country)}</b> <span className="font-mono">{uid(b)}</span></div>
                  </div>
                </div>
              </td>
              {slots.map((s) => {
                const m = at.get(`${b.id}|${s.startAt.getTime()}`);
                return (
                  <td key={s.no} className="border-b border-l border-slate-100 p-1">
                    {m ? (cellHref
                      ? <Link href={cellHref(m)} title={`${m.seller.name} (${uid(m.seller)}) — ${fmtTime(m.startAt)}${m.ticketNo ? ` · ${m.ticketNo}` : ""}`} className="block truncate rounded-md bg-brand-50 px-1.5 py-1 font-medium text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100">{m.seller.name}</Link>
                      : <span title={`${m.seller.name} (${uid(m.seller)})${m.ticketNo ? ` · ${m.ticketNo}` : ""}`} className="block truncate rounded-md bg-brand-50 px-1.5 py-1 font-medium text-brand-800 ring-1 ring-brand-200">{m.seller.name}</span>)
                      : <span className="block h-6" />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Directorate: the draft schedule — generate, review by day, edit, publish. */
export async function DraftSchedule({ user, base, day: dayParam, view }: { user: User; base: string; day?: string; view?: string }) {
  const dic = user.role === "DIC";
  const cfg = await getEventConfig();
  const day = cfg.days.find((d) => d.date === dayParam)?.date ?? cfg.days[0]?.date ?? "";
  const [meetings, pairs, unsched, published, buyers] = await Promise.all([
    prisma.meeting.findMany({ orderBy: { startAt: "asc" }, include: { seller: { select: { name: true, district: true, approvedNo: true, regNo: true } }, buyer: { select: { name: true, pavilionNo: true, country: true, approvedNo: true, regNo: true } } } }),
    prisma.publishedMatch.count(), unscheduledPairs(), prisma.scheduledMeeting.findMany({ select: { buyerId: true, sellerId: true, startAt: true } }),
    prisma.buyer.findMany({ where: { status: "APPROVED", OR: [{ meetings: { some: {} } }, { pavilionNo: { not: null } }] }, orderBy: [{ pavilionNo: "asc" }, { approvedSeq: "asc" }], select: { id: true, name: true, pavilionNo: true, country: true, approvedNo: true, regNo: true } }),
  ]);
  const slots = allSlots(cfg);
  const pub = new Map(published.map((p) => [`${p.buyerId}|${p.sellerId}`, p.startAt.getTime()]));
  const changes = cfg.version ? {
    added: meetings.filter((m) => !pub.has(`${m.buyerId}|${m.sellerId}`)).length,
    moved: meetings.filter((m) => pub.has(`${m.buyerId}|${m.sellerId}`) && pub.get(`${m.buyerId}|${m.sellerId}`) !== m.startAt.getTime()).length,
    removed: published.filter((p) => !meetings.some((m) => m.buyerId === p.buyerId && m.sellerId === p.sellerId)).length,
  } : null;
  const outside = meetings.filter((m) => !slots.some((s) => s.startAt.getTime() === m.startAt.getTime())).length;
  const sellers = view === "sellers" ? [...new Map(meetings.map((m) => [m.sellerId, m.seller])).entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)) : [];
  return (
    <>
      <PageHeader eyebrow="Event days" title="Draft schedule"
        subtitle={`Working schedule — seen only by the Directorate, FIEO and Admin until it is published.${cfg.generatedAt ? ` Last generated ${fmtDateTime(cfg.generatedAt)}.` : ""}`}
        actions={<DownloadButtons href="/api/reports/event-schedule?v=draft" label="Draft schedule" compact />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Meetings scheduled" value={`${meetings.length} / ${pairs}`} accent="green" hint="Pairs of the published mapping" />
        <StatCard label="Not scheduled" value={unsched.length} accent={unsched.length ? "red" : "slate"} hint={unsched.length ? "Place them by hand or add hours" : "Every pair has a slot"} />
        <StatCard label="Slots" value={slots.length} accent="blue" hint={`${cfg.days.length} day${cfg.days.length === 1 ? "" : "s"}`} />
        <StatCard label="Published" value={cfg.version ? `v${cfg.version}` : "—"} accent="yellow" hint={changes ? `${changes.added} added · ${changes.moved} moved · ${changes.removed} removed since` : "Not published yet"} />
      </div>
      {!slots.length && <Alert tone="amber" className="mb-6">Set the event dates and hours first (Dates &amp; hours).</Alert>}
      {outside > 0 && <Alert tone="amber" className="mb-6">{outside} meeting{outside > 1 ? "s are" : " is"} outside the current slots (hours changed). Use <b>Rebuild</b> to re-place them.</Alert>}
      {dic && (
        <Card className="mb-6 flex flex-wrap items-start gap-2 p-4">
          <ActionButton action={scheduleAction} fields={{ op: "fill" }} variant="primary" label={<><Sparkles className="size-4" /> {meetings.length ? "Fill gaps" : "Generate the schedule"}</>} />
          {meetings.length > 0 && <ActionButton action={scheduleAction} fields={{ op: "rebuild" }} label="Rebuild (keep manual changes)" confirm="Rebuild the draft? Automatic placements are recomputed; meetings you placed or moved are kept." />}
          {meetings.length > 0 && <ActionButton action={scheduleAction} fields={{ op: "publish" }} variant="success" label={<><Rocket className="size-4" /> {cfg.version ? "Republish" : "Publish"} schedule</>}
            confirm={`${cfg.version ? "Republish" : "Publish"} ${meetings.length} meetings?${unsched.length ? ` ${unsched.length} pairs are not scheduled.` : ""} Buyers and sellers will see their schedule and tickets.`} />}
          {meetings.length > 0 && <ActionButton action={scheduleAction} fields={{ op: "clear" }} variant="ghost" label={<><Trash2 className="size-4" /> Clear draft</>} confirm="Clear the whole draft schedule? The published schedule is not affected." />}
        </Card>
      )}
      {unsched.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <CardHeader title={`Not scheduled (${unsched.length})`} icon={<CalendarX2 className="size-4" />} subtitle="Pairs of the published mapping without a slot" />
          <ul className="divide-y divide-slate-100">
            {unsched.map((p) => (
              <li key={`${p.buyerId}|${p.sellerId}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span className="flex flex-wrap items-center gap-1.5"><b className="text-ink">P{p.buyer.pavilionNo ?? "–"}</b> <Flag country={p.buyer.country} /> <b className="text-ink">{p.buyer.name}</b> <UidPill id={uid(p.buyer)} tone="buyer" /> — {p.seller.name} <UidPill id={uid(p.seller)} tone="seller" /> <span className="text-slate-500">({p.seller.district})</span></span>
                {dic && <Link href={`${base}/schedule/place?buyerId=${p.buyerId}&sellerId=${p.sellerId}`} className="text-sm font-semibold text-brand-700 hover:underline">Place in a slot →</Link>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 text-sm">
          <Link href={`${base}/schedule?day=${day}`} className={cn("rounded-lg px-3 py-1.5 font-semibold ring-1", view !== "sellers" ? "bg-brand-50 text-brand-800 ring-brand-200" : "text-slate-600 ring-slate-200")}>By pavilion</Link>
          <Link href={`${base}/schedule?view=sellers`} className={cn("rounded-lg px-3 py-1.5 font-semibold ring-1", view === "sellers" ? "bg-brand-50 text-brand-800 ring-brand-200" : "text-slate-600 ring-slate-200")}>By seller</Link>
        </div>
        {dic && <span className="text-xs text-slate-500">Click a meeting to move it to another slot or remove it.</span>}
      </div>
      {view === "sellers" ? (
        <Card className="overflow-hidden">
          {sellers.length ? (
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5 text-left">Seller</th><th className="px-3 py-2.5 text-left">Meetings (day · time · pavilion · buyer)</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {sellers.map(([id, s]) => (
                    <tr key={id} className="align-top">
                      <td className="px-4 py-2"><div className="font-semibold text-ink">{s.name}</div><div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><UidPill id={uid(s)} tone="seller" /> {s.district}</div></td>
                      <td className="px-3 py-2"><div className="flex flex-wrap gap-1.5">
                        {meetings.filter((m) => m.sellerId === id).map((m) => (
                          <Link key={m.id} href={dic ? `${base}/schedule/m/${m.id}` : "#"} className="rounded-md bg-slate-50 px-2 py-1 text-xs ring-1 ring-slate-200 hover:ring-brand-300">
                            D{cfg.days.find((d) => d.date === m.day)?.n} · {fmtTime(m.startAt)} · P{m.buyer.pavilionNo ?? "–"} <Flag country={m.buyer.country} /> {m.buyer.name} <span className="font-mono text-slate-500">{uid(m.buyer)}</span>
                          </Link>
                        ))}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={<CalendarX2 className="size-5" />} title="No meetings in the draft" />}
        </Card>
      ) : (
        <>
          <DayTabs cfg={cfg} day={day} href={(d) => `${base}/schedule?day=${d}`} />
          <Card className="overflow-hidden">
            {meetings.length ? <ScheduleGrid cfg={cfg} day={day} buyers={buyers} meetings={meetings.filter((m) => m.day === day)} cellHref={dic ? (m) => `${base}/schedule/m/${m.id}` : undefined} />
              : <EmptyState icon={<CalendarX2 className="size-5" />} title="No meetings in the draft">{dic ? "Generate the schedule above." : "The Directorate has not generated it yet."}</EmptyState>}
          </Card>
        </>
      )}
    </>
  );
}

function SlotPicker({ slots, cfg, fields, current }: { slots: Awaited<ReturnType<typeof freeSlotsFor>>; cfg: EventConfig; fields: Record<string, string>; current?: Date }) {
  return (
    <div className="space-y-4">
      {cfg.days.map((d) => {
        const list = slots.filter((s) => s.day === d.date);
        return (
          <div key={d.date}>
            <div className="mb-2 text-sm font-bold text-ink">Day {d.n} · {fmtDay(d.date)}</div>
            {list.length ? <div className="flex flex-wrap gap-2">
              {list.map((s) => current && s.startAt.getTime() === current.getTime()
                ? <span key={s.no} className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-white">{fmtTime(s.startAt)} (current)</span>
                : <ActionButton key={s.no} action={meetingEditAction} fields={{ ...fields, slot: s.startAt.toISOString() }} compact label={fmtTime(s.startAt)} />)}
            </div> : <p className="text-sm text-slate-500">No slot free for both on this day.</p>}
          </div>
        );
      })}
    </div>
  );
}

export async function MeetingEdit({ base, id }: { base: string; id: string }) {
  const m = await prisma.meeting.findUnique({ where: { id }, include: { buyer: { select: { name: true, pavilionNo: true, country: true, approvedNo: true, regNo: true } }, seller: { select: { name: true, district: true, approvedNo: true, regNo: true } } } });
  if (!m) notFound();
  const [cfg, free] = await Promise.all([getEventConfig(), freeSlotsFor(m.buyerId, m.sellerId, m.id)]);
  return (
    <>
      <PageHeader back={{ href: `${base}/schedule?day=${m.day}`, label: "Back to draft schedule" }} eyebrow="Draft schedule · move a meeting"
        title={`${m.seller.name} → P${m.buyer.pavilionNo ?? "–"} ${m.buyer.name}`}
        subtitle={`Seller ${uid(m.seller)} · buyer ${uid(m.buyer)} (${m.buyer.country}). Now: ${fmtDay(m.day)}, ${fmtTime(m.startAt)}–${fmtTime(m.endAt)}${m.manual ? " · placed by the Directorate" : ""}. Only slots free for both the buyer and the seller are offered.`} />
      <Card className="mb-6 p-6"><SlotPicker slots={free} cfg={cfg} fields={{ op: "move", meetingId: m.id }} current={m.startAt} /></Card>
      <Card className="p-6">
        <div className="mb-2 font-bold text-ink">Remove from the draft</div>
        <p className="mb-3 text-sm text-slate-600">The pair stays in the mapping and is listed under &lsquo;Not scheduled&rsquo; until placed again.</p>
        <ActionButton action={meetingEditAction} fields={{ op: "remove", meetingId: m.id }} variant="danger" label={<><Trash2 className="size-4" /> Remove meeting</>} confirm="Remove this meeting from the draft?" />
      </Card>
    </>
  );
}

export async function PlacePair({ base, buyerId, sellerId }: { base: string; buyerId: string; sellerId: string }) {
  const [b, s, pair] = await Promise.all([
    prisma.buyer.findUnique({ where: { id: buyerId }, select: { name: true, pavilionNo: true, country: true, approvedNo: true, regNo: true } }),
    prisma.seller.findUnique({ where: { id: sellerId }, select: { name: true, district: true, approvedNo: true, regNo: true } }),
    prisma.publishedMatch.findFirst({ where: { buyerId, sellerId } }),
  ]);
  if (!b || !s || !pair) notFound();
  const [cfg, free] = await Promise.all([getEventConfig(), freeSlotsFor(buyerId, sellerId)]);
  return (
    <>
      <PageHeader back={{ href: `${base}/schedule`, label: "Back to draft schedule" }} eyebrow="Draft schedule · place a meeting"
        title={`${s.name} → P${b.pavilionNo ?? "–"} ${b.name}`} subtitle={`Seller ${uid(s)} · buyer ${uid(b)} (${b.country}). Slots free for both the buyer and the seller.`} />
      <Card className="p-6">{free.length ? <SlotPicker slots={free} cfg={cfg} fields={{ op: "place", buyerId, sellerId }} /> : <Alert tone="amber">No common free slot. Move another meeting, or add hours or a day.</Alert>}</Card>
    </>
  );
}

/** The published schedule (Directorate / FIEO / Admin), by day and pavilion, with ticket numbers. */
export async function PublishedSchedule({ base, day: dayParam }: { base: string; day?: string }) {
  const cfg = await getEventConfig();
  const day = cfg.days.find((d) => d.date === dayParam)?.date ?? cfg.days[0]?.date ?? "";
  const [meetings, buyers] = await Promise.all([
    prisma.scheduledMeeting.findMany({ where: { day }, orderBy: { startAt: "asc" }, include: { seller: { select: { name: true, approvedNo: true, regNo: true } } } }),
    prisma.buyer.findMany({ where: { scheduled: { some: {} } }, orderBy: [{ pavilionNo: "asc" }, { approvedSeq: "asc" }], select: { id: true, name: true, pavilionNo: true, country: true, approvedNo: true, regNo: true } }),
  ]);
  const total = await prisma.scheduledMeeting.count();
  return (
    <>
      <PageHeader eyebrow="Event days" title="Published schedule"
        subtitle={cfg.version ? `Version ${cfg.version} · published ${fmtDateTime(cfg.publishedAt)} · ${total} meetings. Seen by buyers, sellers, nodal officers, FIEO and the Directorate.` : "Not published yet."}
        actions={cfg.version ? <div className="flex flex-wrap gap-2"><DownloadButtons href="/api/reports/event-schedule" label="Schedule" compact /><DownloadButtons href="/api/reports/event-attendance" label="Attendance" compact /></div> : undefined} />
      {cfg.version ? (
        <>
          <DayTabs cfg={cfg} day={day} href={(d) => `${base}/published?day=${d}`} />
          <Card className="overflow-hidden"><ScheduleGrid cfg={cfg} day={day} buyers={buyers} meetings={meetings} /></Card>
          <p className="mt-3 text-xs text-slate-500"><Badge tone="slate">Tip</Badge> Hover a meeting for its ticket number.</p>
        </>
      ) : <Card><EmptyState icon={<CalendarX2 className="size-5" />} title="The schedule has not been published" /></Card>}
    </>
  );
}
