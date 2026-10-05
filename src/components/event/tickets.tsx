import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, MapPin, Printer, Ticket as TicketIcon } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { EVENT } from "@/lib/config";
import { fmtDay, fmtTime, getEventConfig, LIVE_META, liveStatus } from "@/lib/event";
import { fmtDateTime, parseCerts } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { Logo } from "@/components/logo";
import { CountryTag, Flag, UidPill, uid } from "@/components/ids";
import { cn } from "@/lib/cn";

const INCLUDE = {
  buyer: { select: { id: true, name: true, country: true, approvedNo: true, regNo: true, pocName: true, pocDesignation: true, nodalOfficer: { select: { id: true, name: true, mobile: true } },
    requirement: { select: { items: { where: { status: "APPROVED" as const }, orderBy: { sortOrder: "asc" as const }, select: { products: true, certifications: true, sector: { select: { name: true } } } } } } } },
  seller: { select: { id: true, name: true, district: true, approvedNo: true, regNo: true, contactName: true, contactMobile: true, certifications: true,
    products: { orderBy: { sortOrder: "asc" as const }, select: { products: true, sector: { select: { name: true } } } } } },
};
type FullMeeting = Awaited<ReturnType<typeof loadMeetings>>[number];
const loadMeetings = (where: { buyerId?: string; sellerId?: string; ticketNo?: string }) =>
  prisma.scheduledMeeting.findMany({ where, orderBy: { startAt: "asc" }, include: INCLUDE });

/** A seller's meeting ticket — shown on screen and printable (one per page when printing all). */
export function MeetingTicket({ m, dayNo, venue }: { m: FullMeeting; dayNo: number; venue: string }) {
  return (
    <article className="break-inside-avoid overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-300 print:mb-6 print:shadow-none">
      <div className="tx-ribbon h-1.5" />
      <div className="flex flex-col gap-3 border-b border-dashed border-slate-300 px-6 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div><Logo /><div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">{EVENT.programme} · meeting ticket</div></div>
        <div className="sm:text-right">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Ticket no.</div>
          <div className="whitespace-nowrap font-mono text-lg font-extrabold tracking-wider text-ink sm:text-xl">{m.ticketNo}</div>
        </div>
      </div>
      <div className="grid gap-5 px-6 py-5 sm:grid-cols-[auto_1fr]">
        <div className="grid place-items-center rounded-2xl bg-ink px-6 py-4 text-center text-white">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">Pavilion</div>
          <div className="text-5xl font-extrabold tabular-nums">{m.pavilionNo ?? "–"}</div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-ink">
            <span className="inline-flex items-center gap-1.5 font-bold"><CalendarClock className="size-4 text-brand-700" /> Day {dayNo} · {fmtDay(m.day)}</span>
            <span className="text-lg font-extrabold tabular-nums">{fmtTime(m.startAt)} – {fmtTime(m.endAt)}</span>
          </div>
          {venue && <div className="inline-flex items-center gap-1.5 text-sm text-slate-600"><MapPin className="size-4" /> {venue}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Buyer</div>
              <div className="flex items-center gap-1.5 font-bold text-ink"><Flag country={m.buyer.country} /> {m.buyer.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600"><UidPill id={uid(m.buyer)} tone="buyer" /> <CountryTag country={m.buyer.country} name flag={false} /></div>
              {m.buyer.pocName && <div className="text-xs text-slate-600">{m.buyer.pocName}{m.buyer.pocDesignation ? `, ${m.buyer.pocDesignation}` : ""}</div>}
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Seller</div>
              <div className="font-bold text-ink">{m.seller.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600"><UidPill id={uid(m.seller)} tone="seller" /> {m.seller.district}, Kerala</div>
              <div className="text-xs text-slate-600">{m.seller.contactName} · {fmtMobile(m.seller.contactMobile)}</div>
            </div>
          </div>
          {m.buyer.nodalOfficer && <div className="text-xs text-slate-600">Nodal officer at the pavilion: <b className="text-ink">{m.buyer.nodalOfficer.name}</b> · {fmtMobile(m.buyer.nodalOfficer.mobile)}</div>}
        </div>
      </div>
      <div className="border-t border-dashed border-slate-300 bg-slate-50 px-6 py-2.5 text-[11px] text-slate-500">
        Seller ID {uid(m.seller)} · show this ticket to the nodal officer at pavilion {m.pavilionNo ?? ""} before the meeting. Please arrive 5 minutes early; each meeting is strictly time-bound.
      </div>
    </article>
  );
}

/** Buyer / seller: published meetings with details (tickets are for sellers only). */
export async function MyMeetings({ user, base }: { user: User; base: "/buyer" | "/seller" }) {
  const isBuyer = user.role === "BUYER";
  const buyerInfo = isBuyer ? await prisma.buyer.findUnique({ where: { userId: user.id }, select: { id: true, approvedNo: true, regNo: true, pavilionNo: true, nodalOfficer: { select: { name: true, mobile: true } } } }) : null;
  const who = isBuyer ? buyerInfo : await prisma.seller.findFirst({ where: { userId: user.id, status: "APPROVED" }, select: { id: true, approvedNo: true, regNo: true } });
  if (!who) redirect(base);
  const [cfg, meetings] = await Promise.all([getEventConfig(), loadMeetings(isBuyer ? { buyerId: who.id } : { sellerId: who.id })]);
  const now = new Date();
  const dayNo = new Map(cfg.days.map((d) => [d.date, d.n]));
  const days = [...new Set(meetings.map((m) => m.day))];
  return (
    <>
      <PageHeader eyebrow={`Event days · ${isBuyer ? "Buyer" : "Seller"} ID ${uid(who)}`} title="My meetings"
        subtitle={cfg.version ? `${meetings.length} meeting${meetings.length === 1 ? "" : "s"} · schedule published ${fmtDateTime(cfg.publishedAt)}${cfg.venue ? ` · ${cfg.venue}` : ""}` : "Your meeting schedule will appear here once the Directorate publishes it."}
        actions={!isBuyer && meetings.length ? <ButtonLink href={`${base}/meetings/tickets`} variant="secondary"><Printer className="size-4" /> Print all tickets</ButtonLink> : undefined} />
      {isBuyer && buyerInfo && cfg.version > 0 && (
        <Card className="mb-6 flex flex-wrap items-center gap-6 p-5">
          <div className="grid place-items-center rounded-2xl bg-ink px-5 py-3 text-center text-white"><div className="text-[10px] font-bold uppercase tracking-widest text-white/70">Your pavilion</div><div className="text-4xl font-extrabold tabular-nums">{buyerInfo.pavilionNo ?? "–"}</div></div>
          <div className="text-sm text-slate-600">
            Sellers come to your pavilion for each meeting. {buyerInfo.nodalOfficer ? <>Your nodal officer: <b className="text-ink">{buyerInfo.nodalOfficer.name}</b> · {fmtMobile(buyerInfo.nodalOfficer.mobile)}</> : "Your nodal officer will be shown here."}
          </div>
        </Card>
      )}
      {!meetings.length ? (
        <Card><EmptyState icon={<CalendarClock className="size-5" />} title={cfg.version ? "No meetings scheduled for you" : "Schedule not published yet"}>
          {cfg.version ? "If you expected meetings, please write to the programme desk." : `You will be informed by e-mail when your meeting schedule${isBuyer ? "" : " and tickets"} are ready.`}
        </EmptyState></Card>
      ) : days.map((day) => (
        <section key={day} className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-ink">Day {dayNo.get(day)} · {fmtDay(day)}</h2>
          <ol className="space-y-3">
            {meetings.filter((m) => m.day === day).map((m) => {
              const live = liveStatus(m, now);
              return (
                <li key={m.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="text-center"><div className="text-xl font-extrabold tabular-nums text-ink">{fmtTime(m.startAt)}</div><div className="text-xs text-slate-500">to {fmtTime(m.endAt)}</div></div>
                      <div>
                        <div className="flex items-center gap-1.5 text-base font-bold text-ink">{!isBuyer && <Flag country={m.buyer.country} />}{isBuyer ? m.seller.name : m.buyer.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                          {isBuyer ? <><UidPill id={uid(m.seller)} tone="seller" /> {m.seller.district}, Kerala · {m.seller.contactName} · {fmtMobile(m.seller.contactMobile)}</>
                            : <><UidPill id={uid(m.buyer)} tone="buyer" /> <CountryTag country={m.buyer.country} name flag={false} /> · Pavilion {m.pavilionNo ?? "–"}</>}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {isBuyer ? m.seller.products.map((p) => `${p.sector.name}: ${p.products}`).join(" · ") : (m.buyer.requirement?.items ?? []).map((i) => `${i.sector.name}: ${i.products}`).join(" · ")}
                        </div>
                        {isBuyer && parseCerts(m.seller.certifications).length > 0 && <div className="mt-1 flex flex-wrap gap-1">{parseCerts(m.seller.certifications).map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>}
                      </div>
                    </div>
                    <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                      <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold ring-1", LIVE_META[live].tone)}>{LIVE_META[live].label}</span>
                      {isBuyer ? <span className="whitespace-nowrap font-mono text-xs text-slate-500">Ref. {m.ticketNo}</span>
                        : <Link href={`${base}/meetings/${m.ticketNo}`} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-brand-700 hover:underline"><TicketIcon className="size-4" /> Ticket {m.ticketNo}</Link>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}

/** One ticket, or all of a seller's tickets for printing. Buyers do not get tickets. */
export async function TicketPage({ user, ticketNo }: { user: User; ticketNo?: string }) {
  const base = "/seller";
  const who = await prisma.seller.findFirst({ where: { userId: user.id, status: "APPROVED" }, select: { id: true } });
  if (!who) redirect(base);
  const [cfg, meetings] = await Promise.all([getEventConfig(), loadMeetings({ sellerId: who.id, ...(ticketNo ? { ticketNo } : {}) })]);
  if (ticketNo && !meetings.length) notFound();
  const dayNo = new Map(cfg.days.map((d) => [d.date, d.n]));
  return (
    <>
      <div className="no-print">
        <PageHeader back={{ href: `${base}/meetings`, label: "Back to my meetings" }} eyebrow="Event days" title={ticketNo ? `Ticket ${ticketNo}` : `All my tickets (${meetings.length})`}
          subtitle="Print, or show it on your phone at the pavilion."
          actions={<span className="text-sm text-slate-500">Use your browser&apos;s Print (Ctrl + P) — one ticket per section.</span>} />
      </div>
      <div className="mx-auto max-w-3xl space-y-6">{meetings.map((m) => <MeetingTicket key={m.id} m={m} dayNo={dayNo.get(m.day) ?? 0} venue={cfg.venue} />)}</div>
    </>
  );
}

export { loadMeetings };
