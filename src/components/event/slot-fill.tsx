import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarClock, MapPin, UserPlus } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { fmtDay, fmtTime, LIVE_META, liveStatus, slotOptions } from "@/lib/event";
import { fillSlotAction, laterSlotAction } from "@/app/actions/event";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/match/action-button";
import { Flag, UidPill, uid } from "@/components/ids";
import { fmtMobile } from "@/lib/text";
import { cn } from "@/lib/cn";

/**
 * An absent seller's slot (nodal officer of the buyer, or Directorate): give it to another matched seller of the buyer
 * who is free now, and/or give the absent seller a later slot that day.
 */
export async function SlotFill({ user, id, back }: { user: User; id: string; back: string }) {
  const now = new Date();
  const o = await slotOptions(id, now);
  if (!o) notFound();
  const { target: t, cfg } = o;
  if (user.role === "NODAL" && t.buyer.nodalOfficer?.userId !== user.id) notFound();
  const dayNo = new Map(cfg.days.map((d) => [d.date, d.n]));
  const live = liveStatus(t, now);
  const backHref = `${back}${back.includes("?") ? "&" : "?"}day=${t.day}`;
  return (
    <>
      <PageHeader back={{ href: backHref, label: "Back" }} eyebrow={`Pavilion ${t.pavilionNo ?? "–"} · Day ${dayNo.get(t.day)} · ${fmtTime(t.startAt)}–${fmtTime(t.endAt)}`}
        title="Fill this slot"
        subtitle="Give the absent seller's slot to another seller matched with this buyer who is free now. Only sellers in the buyer's published mapping are offered." />
      <Card className="mb-6 grid gap-4 p-5 md:grid-cols-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-sky-800">Buyer</div>
          <div className="flex items-center gap-2 text-lg font-bold text-ink"><Flag country={t.buyer.country} /> {t.buyer.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600"><UidPill id={uid(t.buyer)} tone="buyer" /> {t.buyer.country} · nodal officer {t.buyer.nodalOfficer?.name ?? "not assigned"}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-red-700">Seller of this slot</div>
          <div className="text-lg font-bold text-ink">{t.seller.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <UidPill id={uid(t.seller)} tone="seller" /> {t.seller.district} · {t.seller.contactName} · {fmtMobile(t.seller.contactMobile)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("rounded-md px-2 py-0.5 font-semibold ring-1", LIVE_META[live].tone)}>{LIVE_META[live].label}</span>
            <span className="font-mono text-slate-500">{t.ticketNo}</span>
            {t.movedFrom && <span className="text-slate-500">moved from {fmtTime(t.movedFrom)}</span>}
          </div>
        </div>
      </Card>

      {o.filledBy && (
        <Alert tone="green" className="mb-6" title={o.replacement ? `Slot given to ${o.replacement.seller.name}` : "This slot has been given to another seller"}>
          {o.replacement && <>Seller ID <b className="font-mono">{uid(o.replacement.seller)}</b> · ticket <b className="font-mono">{o.replacement.ticketNo}</b>
            {o.replacement.movedFrom ? ` · moved forward from ${fmtTime(o.replacement.movedFrom)}` : " · new meeting"}{o.replacement.movedBy ? ` · by ${o.replacement.movedBy.displayName}` : ""}.
            {" "}Mark the seller present when they reach the pavilion.</>}
        </Alert>
      )}
      {!o.fillable && !o.filledBy && (
        <Alert tone="slate" className="mb-6">
          {now >= t.endAt ? "This slot is over." : t.status === "SCHEDULED" ? `The slot starts at ${fmtTime(t.startAt)}. It can be filled once the seller is marked absent, or once it has started without the seller.`
            : t.status === "SELLER_PRESENT" ? "The seller is present — the slot is in use." : "This slot cannot be filled."}
        </Alert>
      )}

      {o.fillable && (
        <Card className="mb-6 overflow-hidden">
          <CardHeader title={`Sellers free now (${o.candidates.length})`} icon={<UserPlus className="size-4" />}
            subtitle={t.status === "SCHEDULED" ? `Choosing one also marks ${t.seller.name} absent.` : "Sellers already at the venue are listed first."} />
          {o.candidates.length ? (
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-2 text-left">Seller</th><th className="px-3 py-2 text-left">Their meeting with this buyer</th><th className="px-3 py-2 text-left">Their next meeting elsewhere</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {o.candidates.map((c) => (
                    <tr key={c.seller.id} className={cn(c.atVenue && "bg-brand-50/40")}>
                      <td className="px-5 py-2.5">
                        <div className="flex flex-wrap items-center gap-2 font-semibold text-ink">{c.seller.name} <UidPill id={uid(c.seller)} tone="seller" />{c.atVenue && <Badge tone="green"><MapPin className="size-3" /> At the venue</Badge>}</div>
                        <div className="text-xs text-slate-500">{c.seller.district} · {c.seller.contactName} · {fmtMobile(c.seller.contactMobile)}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{c.own
                        ? <><b className="text-ink">Day {dayNo.get(c.own.day)} · {fmtTime(c.own.startAt)}</b> <span className="font-mono text-slate-500">{c.own.ticketNo}</span><div className="text-slate-500">moves forward; ticket stays valid</div></>
                        : <span className="text-slate-600">Matched, not in the schedule — a new ticket is issued</span>}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{c.next ? `${fmtTime(c.next.startAt)} · pavilion ${c.next.pavilionNo ?? "–"}` : "None later today"}</td>
                      <td className="px-3 py-2.5 text-right">
                        <ActionButton action={fillSlotAction} fields={{ meetingId: t.id, sellerId: c.seller.id }} compact variant="primary"
                          label={<><ArrowUpRight className="size-3.5" /> Bring in now</>}
                          confirm={`Give the ${fmtTime(t.startAt)} slot at pavilion ${t.pavilionNo ?? "–"} to ${c.seller.name}?${t.status === "SCHEDULED" ? ` ${t.seller.name} is marked absent.` : ""}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={<UserPlus className="size-5" />} title="No matched seller is free in this slot">Every other seller matched with this buyer is in a meeting now, has already met the buyer, or has a meeting too soon after.</EmptyState>}
        </Card>
      )}

      {t.status === "SELLER_ABSENT" && (
        <Card className="overflow-hidden">
          <CardHeader title={`If ${t.seller.name} arrives late — give a later slot today`} icon={<CalendarClock className="size-4" />}
            subtitle="Slots free for both this buyer and this seller. The ticket stays valid with the new time." />
          {o.later.length ? (
            <div className="flex flex-wrap gap-2 p-5">
              {o.later.map((s) => (
                <ActionButton key={s.startAt.toISOString()} action={laterSlotAction} fields={{ meetingId: t.id, slot: s.startAt.toISOString() }} compact variant="secondary"
                  label={`${fmtTime(s.startAt)}–${fmtTime(s.endAt)}`} confirm={`Move ${t.seller.name} to ${fmtTime(s.startAt)} on ${fmtDay(s.day)}?`} />
              ))}
            </div>
          ) : <p className="px-5 py-4 text-sm text-slate-500">No later slot today is free for both.</p>}
        </Card>
      )}
      <p className="mt-4 text-xs text-slate-500">Changes appear at once in the buyer&apos;s and seller&apos;s &lsquo;My meetings&rsquo;, the live monitor and the attendance report, and are copied into the draft so a republish keeps them. <Link href={backHref} className="font-semibold text-brand-700">Back</Link></p>
    </>
  );
}
