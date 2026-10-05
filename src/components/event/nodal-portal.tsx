import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ScanLine, UserCheck, UserX, Undo2, XCircle } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import type { MeetingStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { fmtDay, fmtTime, getEventConfig, istDay, LIVE_META, liveStatus } from "@/lib/event";
import { buyerDayAction, markMeetingAction } from "@/app/actions/event";
import { Alert, Badge, Card, CardHeader, EmptyState, Input, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/match/action-button";
import { AutoRefresh } from "./auto-refresh";
import { DayTabs } from "./schedule";
import { MeetingTicket, loadMeetings } from "./tickets";
import { cn } from "@/lib/cn";
import { CountryTag, Flag, UidPill, uid } from "@/components/ids";

/** Mark buttons for one meeting (nodal officer / Directorate). */
export function MarkButtons({ id, status }: { id: string; status: MeetingStatus }) {
  const b = (s: MeetingStatus, label: React.ReactNode, variant: "primary" | "secondary" | "danger" | "success" | "ghost" = "secondary") =>
    <ActionButton key={s} action={markMeetingAction} fields={{ meetingId: id, status: s }} compact variant={variant} label={label} />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "SCHEDULED" && <>{b("SELLER_PRESENT", <><UserCheck className="size-3.5" /> Seller present</>, "success")}{b("SELLER_ABSENT", <><UserX className="size-3.5" /> Seller absent</>, "danger")}</>}
      {status === "SELLER_PRESENT" && b("COMPLETED", <><CheckCircle2 className="size-3.5" /> Meeting completed</>, "primary")}
      {status !== "SCHEDULED" && b("SCHEDULED", <><Undo2 className="size-3.5" /> Undo</>, "ghost")}
    </div>
  );
}

async function officerOf(user: User) {
  const o = await prisma.nodalOfficer.findUnique({ where: { userId: user.id }, select: { id: true, name: true } });
  if (!o) redirect("/login");
  return o;
}

function VerifyBox({ value }: { value?: string }) {
  return (
    <form action="/nodal/verify" className="flex flex-wrap items-center gap-2">
      <ScanLine className="size-5 text-brand-700" />
      <Input name="t" defaultValue={value} placeholder="Ticket no. (TX-D1-P07-1030) or seller ID" className="max-w-sm font-mono uppercase placeholder:normal-case" aria-label="Ticket number or seller ID" autoComplete="off" />
      <button className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">Verify</button>
    </form>
  );
}

/** Nodal officer: the day's meetings of the buyers assigned to them. */
export async function NodalHome({ user, day: dayParam }: { user: User; day?: string }) {
  const o = await officerOf(user);
  const cfg = await getEventConfig();
  const today = istDay();
  const day = cfg.days.find((d) => d.date === dayParam)?.date ?? cfg.days.find((d) => d.date === today)?.date ?? cfg.days[0]?.date ?? "";
  const [buyers, attendance] = await Promise.all([
    prisma.buyer.findMany({ where: { nodalOfficerId: o.id }, orderBy: [{ pavilionNo: "asc" }],
      select: { id: true, name: true, country: true, approvedNo: true, regNo: true, pavilionNo: true, scheduled: { where: { day }, orderBy: { startAt: "asc" }, include: { seller: { select: { name: true, approvedNo: true, regNo: true, district: true, contactName: true, contactMobile: true } } } } } }),
    prisma.buyerDayAttendance.findMany({ where: { day, buyer: { nodalOfficerId: o.id } } }),
  ]);
  const now = new Date();
  const all = buyers.flatMap((b) => b.scheduled.map((m) => ({ m, s: liveStatus(m, now) })));
  const n = (...k: string[]) => all.filter((x) => k.includes(x.s)).length;
  return (
    <>
      <PageHeader eyebrow={`Nodal officer · ${o.name}`} title={day ? `Day ${cfg.days.find((d) => d.date === day)?.n} · ${fmtDay(day)}` : "Event day"}
        subtitle={`${buyers.length} buyer${buyers.length === 1 ? "" : "s"} assigned to you. Verify each seller's ticket at the pavilion and mark attendance.`}
        actions={day === today ? <AutoRefresh seconds={30} /> : undefined} />
      {!cfg.version ? <Alert tone="slate" className="mb-6">The meeting schedule has not been published yet.</Alert> : <DayTabs cfg={cfg} day={day} href={(d) => `/nodal?day=${d}`} />}
      <Card className="mb-6 p-5"><VerifyBox /></Card>
      <div className="mb-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[["Meetings", all.length, "bg-white ring-slate-200"], ["Completed", n("completed"), "bg-brand-50 ring-brand-200"], ["In meeting", n("in_meeting"), "bg-brand-600 text-white ring-brand-700"],
          ["Awaiting seller", n("awaiting"), "bg-amber-50 ring-amber-300"], ["Upcoming", n("upcoming", "checked_in"), "bg-slate-50 ring-slate-200"], ["Not marked", n("not_marked"), "bg-orange-50 ring-orange-200"]].map(([l, v, c]) => (
          <div key={String(l)} className={cn("rounded-2xl p-4 ring-1", String(c))}><div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{l}</div><div className="text-3xl font-extrabold tabular-nums">{v}</div></div>
        ))}
      </div>
      {!buyers.length && <Card><EmptyState icon={<UserCheck className="size-5" />} title="No buyers assigned to you yet">The Directorate assigns buyers to nodal officers before the event.</EmptyState></Card>}
      <div className="space-y-6">
        {buyers.map((b) => {
          const att = attendance.find((a) => a.buyerId === b.id);
          return (
            <Card key={b.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-xl bg-ink text-xl font-extrabold text-white tabular-nums">{b.pavilionNo ?? "–"}</span>
                  <div><div className="flex items-center gap-1.5 font-bold text-ink"><Flag country={b.country} /> {b.name}</div><div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><UidPill id={uid(b)} tone="buyer" /> <CountryTag country={b.country} name flag={false} /> · {b.scheduled.length} meetings today</div></div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Buyer today:</span>
                  {att ? <Badge tone={att.present ? "green" : "red"}>{att.present ? "Present" : "Absent"}</Badge> : <Badge tone="slate">Not marked</Badge>}
                  {day && <ActionButton action={buyerDayAction} fields={{ buyerId: b.id, day, present: "yes" }} compact variant="secondary" label="Present" />}
                  {day && <ActionButton action={buyerDayAction} fields={{ buyerId: b.id, day, present: "no" }} compact variant="ghost" label="Absent" confirm={`Mark ${b.name} absent today? Their remaining meetings today are marked "buyer absent".`} />}
                </div>
              </div>
              {b.scheduled.length ? (
                <div className="table-scroll relative overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr><th className="px-5 py-2 text-left">Time</th><th className="px-3 py-2 text-left">Seller</th><th className="px-3 py-2 text-left">Ticket</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Mark</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {b.scheduled.map((m) => {
                        const s = liveStatus(m, now);
                        return (
                          <tr key={m.id} className={cn(s === "in_meeting" && "bg-brand-50/60", s === "awaiting" && "bg-amber-50/60")}>
                            <td className="whitespace-nowrap px-5 py-2 font-semibold tabular-nums">{fmtTime(m.startAt)}–{fmtTime(m.endAt)}</td>
                            <td className="px-3 py-2"><div className="flex flex-wrap items-center gap-2 font-semibold text-ink">{m.seller.name} <UidPill id={uid(m.seller)} tone="seller" /></div><div className="text-xs text-slate-500">{m.seller.district} · {m.seller.contactName} · {m.seller.contactMobile}</div></td>
                            <td className="px-3 py-2 font-mono text-xs">{m.ticketNo}</td>
                            <td className="px-3 py-2"><span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold ring-1", LIVE_META[s].tone)}>{LIVE_META[s].label}</span></td>
                            <td className="px-3 py-2"><MarkButtons id={m.id} status={m.status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="px-5 py-4 text-sm text-slate-500">No meetings on this day.</p>}
            </Card>
          );
        })}
      </div>
    </>
  );
}

/** Nodal officer: check a seller's ticket (or look the seller up by their ID) and mark the meeting. */
export async function NodalVerify({ user, t }: { user: User; t?: string }) {
  const o = await officerOf(user);
  const ticket = (t ?? "").trim().toUpperCase();
  if (ticket && !ticket.startsWith("TX-")) return <SellerById o={o} q={ticket} />;
  const [cfg, found] = await Promise.all([getEventConfig(), ticket ? loadMeetings({ ticketNo: ticket }) : Promise.resolve([])]);
  const m = found[0];
  const mine = m ? (await prisma.buyer.findUnique({ where: { id: m.buyerId }, select: { nodalOfficerId: true } }))?.nodalOfficerId === o.id : false;
  const s = m ? liveStatus(m, new Date()) : null;
  const dayNo = m ? cfg.days.find((d) => d.date === m.day)?.n ?? 0 : 0;
  return (
    <>
      <PageHeader back={{ href: "/nodal", label: "Back to today" }} eyebrow={`Nodal officer · ${o.name}`} title="Verify a ticket"
        subtitle="Enter the ticket number from the seller's ticket (printed or on the phone), or the seller's ID (RBSM-Seller-…, RBSM-S-…)." />
      <Card className="mb-6 p-5"><VerifyBox value={ticket} /></Card>
      {ticket && !m && <Alert tone="red" title="No such ticket"><XCircle className="mr-1 inline size-4" /> {ticket} is not in the published schedule. Check the number, or ask the seller to show the ticket from their login.</Alert>}
      {m && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <MeetingTicket m={m} dayNo={dayNo} venue={cfg.venue} />
          <Card className="p-5">
            <div className="mb-2 text-sm font-bold text-ink">Status</div>
            <span className={cn("rounded-md px-2 py-0.5 text-sm font-semibold ring-1", LIVE_META[s!].tone)}>{LIVE_META[s!].label}</span>
            <div className="mt-2 text-xs text-slate-500">Valid for {fmtDay(m.day)}, {fmtTime(m.startAt)}–{fmtTime(m.endAt)} at pavilion {m.pavilionNo ?? "–"}.</div>
            {mine ? <div className="mt-4"><MarkButtons id={m.id} status={m.status} /></div>
              : <Alert tone="amber" className="mt-4">This meeting is at a pavilion assigned to another nodal officer ({m.buyer.nodalOfficer?.name ?? "not assigned"}). Please direct the seller there.</Alert>}
            <Link href="/nodal" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">Back to today&apos;s meetings</Link>
          </Card>
        </div>
      )}
    </>
  );
}

/** Nodal officer: a seller looked up by ID — all their meetings; the officer marks those at their own pavilions. */
async function SellerById({ o, q }: { o: { id: string; name: string }; q: string }) {
  const sellers = await prisma.seller.findMany({ where: { status: "APPROVED", OR: [{ approvedNo: { contains: q } }, { regNo: { contains: q } }, { user: { username: { contains: q } } }] },
    take: 5, select: { id: true, name: true, district: true, approvedNo: true, regNo: true, contactName: true, contactMobile: true } });
  const exact = sellers.find((s) => [s.approvedNo, s.regNo].some((x) => x?.toUpperCase() === q));
  const list = exact ? [exact] : sellers;
  const [cfg, meetings] = await Promise.all([getEventConfig(), list.length === 1 ? loadMeetings({ sellerId: list[0].id }) : Promise.resolve([])]);
  const dayNo = new Map(cfg.days.map((d) => [d.date, d.n]));
  const now = new Date();
  return (
    <>
      <PageHeader back={{ href: "/nodal", label: "Back to today" }} eyebrow={`Nodal officer · ${o.name}`} title="Verify a seller"
        subtitle="The seller's meetings in the published schedule. You can mark the meetings at your own pavilions." />
      <Card className="mb-6 p-5"><VerifyBox value={q} /></Card>
      {!list.length && <Alert tone="red" title="No approved seller with this ID"><XCircle className="mr-1 inline size-4" /> {q} did not match a seller. Seller IDs look like RBSM-Seller-2026012 or RBSM-S-012.</Alert>}
      {list.length > 1 && (
        <Card className="overflow-hidden"><ul className="divide-y divide-slate-100">
          {list.map((s) => <li key={s.id} className="px-5 py-3 text-sm"><Link href={`/nodal/verify?t=${encodeURIComponent(s.approvedNo ?? s.regNo)}`} className="font-semibold text-brand-700 hover:underline">{s.name}</Link> <UidPill id={uid(s)} tone="seller" /> <span className="text-slate-500">{s.district}</span></li>)}
        </ul></Card>
      )}
      {list.length === 1 && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 bg-emerald-50/50 px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-800">Seller</div>
            <div className="text-lg font-bold text-ink">{list[0].name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600"><UidPill id={list[0].approvedNo} tone="seller" /> <UidPill id={list[0].regNo} /> {list[0].district}, Kerala · {list[0].contactName} · {list[0].contactMobile}</div>
          </div>
          {meetings.length ? (
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-2 text-left">Day · time</th><th className="px-3 py-2 text-left">Pavilion · buyer</th><th className="px-3 py-2 text-left">Ticket</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Mark</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {meetings.map((m) => {
                    const s = liveStatus(m, now);
                    const mine = m.buyer.nodalOfficer?.id === o.id;
                    return (
                      <tr key={m.id} className={cn(mine && "bg-brand-50/40")}>
                        <td className="whitespace-nowrap px-5 py-2 tabular-nums">D{dayNo.get(m.day)} · <b>{fmtTime(m.startAt)}</b>–{fmtTime(m.endAt)}</td>
                        <td className="px-3 py-2"><div className="flex flex-wrap items-center gap-1.5 font-semibold text-ink"><span className="rounded bg-ink px-1.5 text-white tabular-nums">{m.pavilionNo ?? "–"}</span> <Flag country={m.buyer.country} /> {m.buyer.name} <UidPill id={uid(m.buyer)} tone="buyer" /></div>
                          {!mine && <div className="text-xs text-slate-500">Nodal officer: {m.buyer.nodalOfficer?.name ?? "not assigned"}</div>}</td>
                        <td className="px-3 py-2 font-mono text-xs">{m.ticketNo}</td>
                        <td className="px-3 py-2"><span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold ring-1", LIVE_META[s].tone)}>{LIVE_META[s].label}</span></td>
                        <td className="px-3 py-2">{mine ? <MarkButtons id={m.id} status={m.status} /> : <span className="text-xs text-slate-400">Another officer&apos;s pavilion</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="px-5 py-4 text-sm text-slate-500">This seller has no meetings in the published schedule.</p>}
        </Card>
      )}
    </>
  );
}
