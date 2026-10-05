import "server-only";
import type { MeetingStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ IST date / time helpers */

const IST_MIN = 330;
const two = (n: number) => String(n).padStart(2, "0");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "YYYY-MM-DD" + "HH:MM" (IST) → instant. */
export function istAt(day: string, time: string) {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, mi) - IST_MIN * 60000);
}
const istParts = (d: Date) => { const t = new Date(d.getTime() + IST_MIN * 60000); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), wd: t.getUTCDay() }; };
/** 10:30 AM */
export const fmtTime = (d: Date) => { const p = istParts(d); return `${two(p.h % 12 || 12)}:${two(p.mi)} ${p.h < 12 ? "AM" : "PM"}`; };
/** 10:30 (24 h, for compact grids and ticket numbers) */
export const hhmm = (d: Date) => { const p = istParts(d); return `${two(p.h)}${two(p.mi)}`; };
/** Today's date in IST, YYYY-MM-DD. */
export const istDay = (d: Date = new Date()) => { const p = istParts(d); return `${p.y}-${two(p.m + 1)}-${two(p.d)}`; };
/** Tue, 17 Nov 2026 */
export const fmtDay = (day: string) => { const p = istParts(istAt(day, "12:00")); return `${DAYS[p.wd]}, ${two(p.d)} ${MONTHS[p.m]} ${p.y}`; };
export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/* ------------------------------------------------------------------ configuration */

export type Break = { label: string; start: string; end: string };
export type Day = { id: string; date: string; startTime: string; endTime: string; breaks: Break[]; n: number };

const KEYS = ["event.meetingMinutes", "event.bufferMinutes", "event.version", "event.publishedAt", "event.venue", "event.generatedAt"] as const;

export async function getEventConfig() {
  const [rows, days] = await Promise.all([
    prisma.matchSetting.findMany({ where: { key: { in: [...KEYS] } } }),
    prisma.eventDay.findMany({ orderBy: { date: "asc" } }),
  ]);
  const v = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    meetingMinutes: Number(v("event.meetingMinutes") ?? 30),
    bufferMinutes: Number(v("event.bufferMinutes") ?? 10),
    version: Number(v("event.version") ?? 0),
    publishedAt: v("event.publishedAt") ? new Date(v("event.publishedAt")!) : null,
    generatedAt: v("event.generatedAt") ? new Date(v("event.generatedAt")!) : null,
    venue: v("event.venue") ?? "",
    days: days.map((d, i): Day => ({ id: d.id, date: d.date, startTime: d.startTime, endTime: d.endTime, breaks: parseBreaks(d.breaks), n: i + 1 })),
  };
}
export type EventConfig = Awaited<ReturnType<typeof getEventConfig>>;

export function parseBreaks(s: string): Break[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((b) => b && isTime(b.start) && isTime(b.end)) : []; } catch { return []; }
}

export async function setEventSetting(key: (typeof KEYS)[number], value: string) {
  await prisma.matchSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/* ------------------------------------------------------------------ slots */

export type Slot = { day: string; dayNo: number; no: number; startAt: Date; endAt: Date };

/**
 * Meeting slots of a day: back-to-back meetings of `meetingMinutes`, each followed by a `bufferMinutes` buffer,
 * from the start time; a slot never runs into a break (it starts after the break) or past the end time.
 */
export function daySlots(day: Day, cfg: Pick<EventConfig, "meetingMinutes" | "bufferMinutes">): Slot[] {
  const out: Slot[] = [];
  const end = minutes(day.endTime);
  const breaks = day.breaks.map((b) => [minutes(b.start), minutes(b.end)] as const).sort((a, b) => a[0] - b[0]);
  let t = minutes(day.startTime);
  while (t + cfg.meetingMinutes <= end) {
    const clash = breaks.find(([bs, be]) => t < be && t + cfg.meetingMinutes > bs);
    if (clash) { t = clash[1]; continue; }
    const s = istAt(day.date, `${two(Math.floor(t / 60))}:${two(t % 60)}`);
    out.push({ day: day.date, dayNo: day.n, no: out.length + 1, startAt: s, endAt: new Date(s.getTime() + cfg.meetingMinutes * 60000) });
    t += cfg.meetingMinutes + cfg.bufferMinutes;
  }
  return out;
}
export const allSlots = (cfg: EventConfig) => cfg.days.flatMap((d) => daySlots(d, cfg));

/** Two meetings clash if they overlap, counting the buffer after each. */
export const clashes = (a: { startAt: Date; endAt: Date }, b: { startAt: Date; endAt: Date }, bufferMin: number) =>
  a.startAt.getTime() < b.endAt.getTime() + bufferMin * 60000 && b.startAt.getTime() < a.endAt.getTime() + bufferMin * 60000;

/* ------------------------------------------------------------------ pavilions */

/**
 * The sector a buyer is seated by: the first sector the buyer chose (approved) that has a matched seller in the
 * published mapping; otherwise the first approved sector.
 */
export async function buyerPrimarySectors() {
  const [buyers, pairs] = await Promise.all([
    prisma.buyer.findMany({ where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" },
      select: { id: true, name: true, country: true, approvedNo: true, regNo: true, approvedSeq: true, pavilionNo: true, nodalOfficerId: true,
        requirement: { select: { items: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" }, select: { sectorId: true, sector: { select: { name: true, sortOrder: true } } } } } } } }),
    prisma.publishedMatch.findMany({ select: { buyerId: true, seller: { select: { products: { select: { sectorId: true } } } } } }),
  ]);
  return buyers.map((b) => {
    const items = b.requirement?.items ?? [];
    const matchedSectors = new Set(pairs.filter((p) => p.buyerId === b.id).flatMap((p) => p.seller.products.map((x) => x.sectorId)));
    const primary = items.find((i) => matchedSectors.has(i.sectorId)) ?? items[0] ?? null;
    return { ...b, primary: primary ? { id: primary.sectorId, name: primary.sector.name, order: primary.sector.sortOrder } : null };
  });
}

/** Number approved buyers 1…n, grouped by primary sector in the sector master's order, then by buyer number. */
export async function assignPavilions() {
  const list = (await buyerPrimarySectors()).sort((a, b) =>
    (a.primary?.order ?? 9999) - (b.primary?.order ?? 9999) || (a.primary?.name ?? "").localeCompare(b.primary?.name ?? "") || (a.approvedSeq ?? 0) - (b.approvedSeq ?? 0));
  await prisma.$transaction([
    prisma.buyer.updateMany({ data: { pavilionNo: null } }),
    ...list.map((b, i) => prisma.buyer.update({ where: { id: b.id }, data: { pavilionNo: i + 1 } })),
  ]);
  return list.length;
}

/* ------------------------------------------------------------------ nodal officers */

/** Shares the buyers among the officers in pavilion order (neighbouring pavilions stay with one officer). */
export async function assignNodalOfficers() {
  const [officers, buyers] = await Promise.all([
    prisma.nodalOfficer.findMany({ orderBy: { createdAt: "asc" }, select: { id: true } }),
    prisma.buyer.findMany({ where: { status: "APPROVED" }, orderBy: [{ pavilionNo: "asc" }, { approvedSeq: "asc" }], select: { id: true, pavilionNo: true } }),
  ]);
  if (!officers.length) return 0;
  const ordered = [...buyers.filter((b) => b.pavilionNo !== null), ...buyers.filter((b) => b.pavilionNo === null)];
  const per = Math.ceil(ordered.length / officers.length);
  await prisma.$transaction(ordered.map((b, i) => prisma.buyer.update({ where: { id: b.id }, data: { nodalOfficerId: officers[Math.min(officers.length - 1, Math.floor(i / per))].id } })));
  return ordered.length;
}

/* ------------------------------------------------------------------ schedule (draft) */

/**
 * Builds the draft: every buyer–seller pair of the published mapping gets one slot, with no buyer or seller in two
 * meetings at once (buffer respected). Pairs are placed round by round (each buyer's first seller, then second …)
 * in pavilion order, each in the earliest slot free for both. "fill" keeps existing meetings; "rebuild" keeps only
 * the Directorate's manual placements. Pairs no longer in the mapping are dropped.
 */
export async function generateSchedule(mode: "fill" | "rebuild") {
  const cfg = await getEventConfig();
  const slots = allSlots(cfg);
  if (!slots.length) return { placed: 0, unplaced: 0, error: "Set the event days and hours first." };
  const pairs = await prisma.publishedMatch.findMany({ orderBy: [{ buyer: { pavilionNo: "asc" } }, { slot: "asc" }], select: { buyerId: true, sellerId: true, slot: true, buyer: { select: { pavilionNo: true, approvedSeq: true } } } });
  const key = (b: string, s: string) => `${b}|${s}`;
  const live = new Set(pairs.map((p) => key(p.buyerId, p.sellerId)));
  const existing = await prisma.meeting.findMany();
  const drop = existing.filter((m) => !live.has(key(m.buyerId, m.sellerId)) || (mode === "rebuild" && !m.manual));
  if (drop.length) await prisma.meeting.deleteMany({ where: { id: { in: drop.map((m) => m.id) } } });
  const kept = existing.filter((m) => !drop.includes(m));
  const has = new Set(kept.map((m) => key(m.buyerId, m.sellerId)));

  const busy = new Map<string, { startAt: Date; endAt: Date }[]>();
  const book = (who: string, m: { startAt: Date; endAt: Date }) => { const l = busy.get(who) ?? []; l.push(m); busy.set(who, l); };
  for (const m of kept) { book(`b${m.buyerId}`, m); book(`s${m.sellerId}`, m); }
  const free = (who: string, s: Slot) => !(busy.get(who) ?? []).some((m) => clashes(m, s, cfg.bufferMinutes));

  // Round by round: rank 1 of every buyer (pavilion order), then rank 2 …
  const byBuyer = new Map<string, typeof pairs>();
  for (const p of pairs) { if (has.has(key(p.buyerId, p.sellerId))) continue; const l = byBuyer.get(p.buyerId) ?? []; l.push(p); byBuyer.set(p.buyerId, l); }
  const order = [...byBuyer.keys()].sort((a, b) => (byBuyer.get(a)![0].buyer.pavilionNo ?? 9999) - (byBuyer.get(b)![0].buyer.pavilionNo ?? 9999) || (byBuyer.get(a)![0].buyer.approvedSeq ?? 0) - (byBuyer.get(b)![0].buyer.approvedSeq ?? 0));
  const rounds = Math.max(0, ...[...byBuyer.values()].map((l) => l.length));
  const create: { buyerId: string; sellerId: string; day: string; startAt: Date; endAt: Date }[] = [];
  let unplaced = 0;
  for (let r = 0; r < rounds; r++) for (const b of order) {
    const p = byBuyer.get(b)![r];
    if (!p) continue;
    const s = slots.find((x) => free(`b${p.buyerId}`, x) && free(`s${p.sellerId}`, x));
    if (!s) { unplaced++; continue; }
    book(`b${p.buyerId}`, s); book(`s${p.sellerId}`, s);
    create.push({ buyerId: p.buyerId, sellerId: p.sellerId, day: s.day, startAt: s.startAt, endAt: s.endAt });
  }
  if (create.length) await prisma.meeting.createMany({ data: create });
  await setEventSetting("event.generatedAt", new Date().toISOString());
  return { placed: create.length, unplaced, kept: kept.length };
}

/** Slots where both the buyer and the seller are free (excluding one meeting being moved). */
export async function freeSlotsFor(buyerId: string, sellerId: string, exceptId?: string) {
  const cfg = await getEventConfig();
  const others = await prisma.meeting.findMany({ where: { OR: [{ buyerId }, { sellerId }], ...(exceptId ? { id: { not: exceptId } } : {}) } });
  return allSlots(cfg).filter((s) => !others.some((m) => clashes(m, s, cfg.bufferMinutes)));
}

/** Pairs of the published mapping without a meeting in the draft. */
export async function unscheduledPairs() {
  const [pairs, meetings] = await Promise.all([
    prisma.publishedMatch.findMany({ orderBy: [{ buyer: { pavilionNo: "asc" } }, { slot: "asc" }],
      select: { buyerId: true, sellerId: true, buyer: { select: { name: true, pavilionNo: true, country: true, approvedNo: true, regNo: true } }, seller: { select: { name: true, district: true, approvedNo: true, regNo: true } } } }),
    prisma.meeting.findMany({ select: { buyerId: true, sellerId: true } }),
  ]);
  const has = new Set(meetings.map((m) => `${m.buyerId}|${m.sellerId}`));
  return pairs.filter((p) => !has.has(`${p.buyerId}|${p.sellerId}`));
}

/** Ticket number: TX-D1-P07-1030 (day, pavilion, start time). */
export const ticketNo = (dayNo: number, pavilion: number | null, buyerSeq: number | null, start: Date) =>
  `TX-D${dayNo}-${pavilion ? `P${two(pavilion)}` : `B${two(buyerSeq ?? 0)}`}-${hhmm(start)}`;

/* ------------------------------------------------------------------ live status */

export type Live = "upcoming" | "checked_in" | "awaiting" | "in_meeting" | "completed" | "not_marked" | "no_show" | "buyer_absent" | "cancelled";

export const LIVE_META: Record<Live, { label: string; tone: string; dot: string }> = {
  upcoming: { label: "Upcoming", tone: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-300" },
  checked_in: { label: "Seller checked in", tone: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500" },
  awaiting: { label: "Awaiting seller", tone: "bg-amber-50 text-amber-800 ring-amber-300", dot: "bg-amber-500" },
  in_meeting: { label: "In meeting", tone: "bg-brand-600 text-white ring-brand-700", dot: "bg-brand-600" },
  completed: { label: "Completed", tone: "bg-brand-50 text-brand-800 ring-brand-200", dot: "bg-tx-green" },
  not_marked: { label: "Not marked", tone: "bg-orange-50 text-orange-800 ring-orange-200", dot: "bg-orange-400" },
  no_show: { label: "Seller absent", tone: "bg-red-50 text-red-700 ring-red-200", dot: "bg-tx-red" },
  buyer_absent: { label: "Buyer absent", tone: "bg-rose-100 text-rose-800 ring-rose-300", dot: "bg-rose-600" },
  cancelled: { label: "Cancelled", tone: "bg-slate-50 text-slate-400 ring-slate-200 line-through", dot: "bg-slate-300" },
};

/** Where a meeting stands at `now`, from its time and the nodal officer's marks. */
export function liveStatus(m: { status: MeetingStatus; startAt: Date; endAt: Date }, now: Date): Live {
  if (m.status === "CANCELLED") return "cancelled";
  if (m.status === "SELLER_ABSENT") return "no_show";
  if (m.status === "BUYER_ABSENT") return "buyer_absent";
  if (m.status === "COMPLETED") return "completed";
  const t = now.getTime();
  if (t < m.startAt.getTime()) return m.status === "SELLER_PRESENT" ? "checked_in" : "upcoming";
  if (t < m.endAt.getTime()) return m.status === "SELLER_PRESENT" ? "in_meeting" : "awaiting";
  return m.status === "SELLER_PRESENT" ? "completed" : "not_marked";
}

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  SCHEDULED: "Scheduled", SELLER_PRESENT: "Seller present", SELLER_ABSENT: "Seller absent", BUYER_ABSENT: "Buyer absent", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

/* ------------------------------------------------------------------ event day: filling a slot */

/** Statuses that keep a buyer / seller busy in a slot. */
const BUSY: MeetingStatus[] = ["SCHEDULED", "SELLER_PRESENT", "COMPLETED"];

/** A slot can be given to another seller while it runs (or before it) once its seller is absent or has not checked in after the start. */
export const canFill = (m: { status: MeetingStatus; startAt: Date; endAt: Date }, now: Date) =>
  now.getTime() < m.endAt.getTime() && (m.status === "SELLER_ABSENT" || (m.status === "SCHEDULED" && now.getTime() >= m.startAt.getTime()));

const PARTY = { approvedNo: true, regNo: true } as const;

/**
 * Options for an absent seller's slot: the buyer's matched sellers who are free in that slot (their later meeting with
 * this buyer is moved forward, or a new meeting is added for a matched pair without one), sellers at the venue first;
 * and, for the absent seller, the later slots that day free for both sides.
 */
export async function slotOptions(meetingId: string, now: Date = new Date()) {
  const cfg = await getEventConfig();
  const target = await prisma.scheduledMeeting.findUnique({ where: { id: meetingId }, include: {
    buyer: { select: { id: true, name: true, country: true, pavilionNo: true, approvedSeq: true, ...PARTY, nodalOfficer: { select: { id: true, userId: true, name: true } } } },
    seller: { select: { id: true, name: true, district: true, contactName: true, contactMobile: true, ...PARTY } } } });
  if (!target) return null;
  const [pairs, sameDay, buyerAll] = await Promise.all([
    prisma.publishedMatch.findMany({ where: { buyerId: target.buyerId, sellerId: { not: target.sellerId }, seller: { status: "APPROVED" } }, orderBy: { slot: "asc" },
      select: { seller: { select: { id: true, name: true, district: true, contactName: true, contactMobile: true, ...PARTY } } } }),
    prisma.scheduledMeeting.findMany({ where: { day: target.day }, select: { id: true, buyerId: true, sellerId: true, startAt: true, endAt: true, status: true, pavilionNo: true } }),
    prisma.scheduledMeeting.findMany({ where: { buyerId: target.buyerId }, select: { id: true, sellerId: true, day: true, startAt: true, endAt: true, status: true, ticketNo: true } }),
  ]);
  const busy = sameDay.filter((m) => BUSY.includes(m.status));
  const slot = { startAt: target.startAt, endAt: target.endAt };
  // Someone else already sits with the buyer in this slot (e.g. the slot was filled before).
  const filledBy = busy.find((m) => m.buyerId === target.buyerId && m.id !== target.id && clashes(m, slot, 0));
  const atVenue = new Set(sameDay.filter((m) => m.status === "SELLER_PRESENT" || m.status === "COMPLETED").map((m) => m.sellerId));
  const candidates = pairs.flatMap(({ seller }) => {
    const own = buyerAll.find((m) => m.sellerId === seller.id);
    // Only a meeting still to come can be moved forward; a pair already met / missed is not offered.
    if (own && (own.status !== "SCHEDULED" && own.status !== "SELLER_PRESENT" || own.startAt.getTime() <= target.startAt.getTime())) return [];
    if (busy.some((m) => m.sellerId === seller.id && m.id !== own?.id && clashes(m, slot, cfg.bufferMinutes))) return [];
    const next = busy.filter((m) => m.sellerId === seller.id && m.id !== own?.id && m.startAt.getTime() > target.startAt.getTime())
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0] ?? null;
    return [{ seller, own: own ?? null, atVenue: atVenue.has(seller.id), next }];
  }).sort((a, b) => Number(b.atVenue) - Number(a.atVenue) || Number(!!b.own) - Number(!!a.own)
    || (a.own?.startAt.getTime() ?? 0) - (b.own?.startAt.getTime() ?? 0) || a.seller.name.localeCompare(b.seller.name));
  const day = cfg.days.find((d) => d.date === target.day);
  const later = target.status === "SELLER_ABSENT" && day
    ? daySlots(day, cfg).filter((s) => s.startAt.getTime() > now.getTime()
      && !busy.some((m) => (m.buyerId === target.buyerId || m.sellerId === target.sellerId) && m.id !== target.id && clashes(m, s, cfg.bufferMinutes)))
    : [];
  const replacement = await prisma.scheduledMeeting.findFirst({ where: { replacesId: target.id, startAt: target.startAt }, orderBy: { movedAt: "desc" },
    select: { ticketNo: true, movedFrom: true, status: true, seller: { select: { name: true, ...PARTY } }, movedBy: { select: { displayName: true } } } });
  return { cfg, target, candidates, later, filledBy: filledBy ?? null, replacement, fillable: canFill(target, now) && !filledBy };
}
export type SlotOptions = NonNullable<Awaited<ReturnType<typeof slotOptions>>>;

/** A ticket number not yet used: the usual one, else with -A, -B … (a second meeting in the same pavilion slot). */
export async function freeTicketNo(base: string) {
  const used = new Set((await prisma.scheduledMeeting.findMany({ where: { ticketNo: { startsWith: base } }, select: { ticketNo: true } })).map((t) => t.ticketNo));
  if (!used.has(base)) return base;
  for (const c of "ABCDEFGHJKLMNPQRSTUVWXYZ") if (!used.has(`${base}-${c}`)) return `${base}-${c}`;
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Keep the draft in step with an event-day change, so a later republish does not undo it: put the pair at `at`
 * (or drop it from the draft when `at` is null). Returns false (draft left as is) if that would clash in the draft.
 */
export async function syncDraft(buyerId: string, sellerId: string, at: { day: string; startAt: Date; endAt: Date } | null, bufferMin: number) {
  if (!at) { await prisma.meeting.deleteMany({ where: { buyerId, sellerId } }); return true; }
  const others = await prisma.meeting.findMany({ where: { OR: [{ buyerId }, { sellerId }], NOT: { buyerId, sellerId } } });
  if (others.some((m) => clashes(m, at, bufferMin))) return false;
  await prisma.meeting.upsert({ where: { buyerId_sellerId: { buyerId, sellerId } }, create: { buyerId, sellerId, ...at, manual: true }, update: { ...at, manual: true } });
  return true;
}
