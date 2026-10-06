/**
 * "The event is on today" — for trying the live monitor, nodal-officer screens and the MoU dashboard.
 *
 *   npm run db:event-today
 *
 * Run it after `npm run db:demo` (it works on any database with approved buyers and sellers). It:
 *  - sets the event days to today and tomorrow, with today's hours placed around the current time (IST),
 *    so some meetings are over, some are running now and the rest are still to come;
 *  - builds and publishes the buyer–seller mapping, assigns pavilions and nodal officers, and publishes
 *    the meeting schedule with tickets;
 *  - marks today's meetings as the nodal officers would: completed, seller present / in meeting, seller absent,
 *    buyer absent, a few not marked yet, and a few absent sellers' slots filled with another matched seller;
 *  - replaces the MoUs with ones filled after today's completed meetings (approved, with the nodal officer or FIEO,
 *    returned, withdrawn; in US$, INR and "to be determined"), the newest a few minutes old.
 *
 * It replaces the mapping, the schedule and the MoUs each time it runs; buyers, sellers and logins are kept.
 * Run it again later in the day to move the event to the new time.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { MatchSource, MeetingStatus, MouStatus } from "../src/generated/prisma/enums";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { EVENT, pad3 } from "../src/lib/config";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });

/* ------------------------------------------------------------------ time (IST) */

const IST = 330;
const MIN = 60000;
const two = (n: number) => String(n).padStart(2, "0");
const istDay = (d: Date) => { const t = new Date(d.getTime() + IST * MIN); return `${t.getUTCFullYear()}-${two(t.getUTCMonth() + 1)}-${two(t.getUTCDate())}`; };
const istMinutes = (d: Date) => { const t = new Date(d.getTime() + IST * MIN); return t.getUTCHours() * 60 + t.getUTCMinutes(); };
const hm = (m: number) => `${two(Math.floor(m / 60))}:${two(m % 60)}`;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const istAt = (day: string, time: string) => { const [y, mo, d] = day.split("-").map(Number); const [h, mi] = time.split(":").map(Number); return new Date(Date.UTC(y, mo - 1, d, h, mi) - IST * MIN); };
const hhmm = (d: Date) => { const t = new Date(d.getTime() + IST * MIN); return `${two(t.getUTCHours())}${two(t.getUTCMinutes())}`; };
const fmt = (d: Date) => { const t = new Date(d.getTime() + IST * MIN); const h = t.getUTCHours(); return `${two(h % 12 || 12)}:${two(t.getUTCMinutes())} ${h < 12 ? "AM" : "PM"}`; };

type Break = { label: string; start: string; end: string };
type Slot = { day: string; dayNo: number; startAt: Date; endAt: Date };
function daySlots(day: string, dayNo: number, start: string, end: string, breaks: Break[], len: number, buffer: number): Slot[] {
  const out: Slot[] = [];
  const bs = breaks.map((b) => [toMin(b.start), toMin(b.end)] as const);
  let t = toMin(start);
  while (t + len <= toMin(end)) {
    const clash = bs.find(([a, b]) => t < b && t + len > a);
    if (clash) { t = clash[1]; continue; }
    const s = istAt(day, hm(t));
    out.push({ day, dayNo, startAt: s, endAt: new Date(s.getTime() + len * MIN) });
    t += len + buffer;
  }
  return out;
}
const clashes = (a: { startAt: Date; endAt: Date }, b: { startAt: Date; endAt: Date }, buffer: number) =>
  a.startAt.getTime() < b.endAt.getTime() + buffer * MIN && b.startAt.getTime() < a.endAt.getTime() + buffer * MIN;

/** Repeatable "random" numbers, so every run gives a similar picture. */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(2026);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];

async function setting(key: string, value: string) {
  await prisma.matchSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/* ------------------------------------------------------------------ main */

async function main() {
  const now = new Date();
  const today = istDay(now), tomorrow = istDay(new Date(now.getTime() + 24 * 60 * MIN));
  const nowMin = istMinutes(now);

  const [dic, fieo] = await Promise.all([prisma.user.findFirst({ where: { role: "DIC" } }), prisma.user.findFirst({ where: { role: "FIEO" } })]);
  if (!dic || !fieo) throw new Error("Run `npm run db:seed` and `npm run db:demo` first.");
  const buyers = await prisma.buyer.findMany({ where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" },
    select: { id: true, name: true, approvedSeq: true, requirement: { select: { items: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" }, select: { sectorId: true, sector: { select: { sortOrder: true } } } } } } } });
  const sellers = await prisma.seller.findMany({ where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" },
    select: { id: true, name: true, approvedSeq: true, products: { orderBy: { sortOrder: "asc" }, select: { sectorId: true, products: true } } } });
  if (!buyers.length || !sellers.length) throw new Error("No approved buyers or sellers — run `npm run db:demo` first.");

  // 1. Event days: today around the current time, tomorrow a normal day.
  const len = 30, buffer = 10;
  // Start about 3½ hours ago, shifted so that the current time falls 10–20 minutes into a running meeting.
  const breaksFrom = (st: number): Break[] => [{ label: "Tea break", start: hm(st + 120), end: hm(st + 140) }, { label: "Lunch break", start: hm(st + 260), end: hm(st + 300) }];
  const inMeeting = (st: number) => daySlots(today, 1, hm(st), hm(Math.min(st + 420, 1430)), breaksFrom(st), len, buffer)
    .some((x) => { const m = istMinutes(x.startAt); return nowMin >= m + 10 && nowMin <= m + 20; });
  const candidates = Array.from({ length: 25 }, (_, i) => Math.floor((nowMin - 215) / 5) * 5 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 5).filter((x) => x >= 0 && x <= 1430 - 300);
  const start = candidates.find(inMeeting) ?? Math.max(0, Math.min(Math.floor((nowMin - 215) / 10) * 10, 1430 - 300));
  const end = Math.min(start + 420, 1430);
  const todayBreaks = breaksFrom(start);
  const tomorrowBreaks: Break[] = [{ label: "Tea break", start: "11:10", end: "11:30" }, { label: "Lunch break", start: "13:00", end: "14:00" }];
  await prisma.eventDay.deleteMany({});
  await prisma.eventDay.create({ data: { date: today, startTime: hm(start), endTime: hm(end), breaks: JSON.stringify(todayBreaks) } });
  await prisma.eventDay.create({ data: { date: tomorrow, startTime: "09:30", endTime: "16:30", breaks: JSON.stringify(tomorrowBreaks) } });
  await setting("event.meetingMinutes", String(len));
  await setting("event.bufferMinutes", String(buffer));
  if (!(await prisma.matchSetting.findUnique({ where: { key: "event.venue" } }))) await setting("event.venue", "Kerala Trade Centre, Kochi");

  // 2. Nodal officers (the demo's four, if there are none) and pavilions by first sector.
  let officers = await prisma.nodalOfficer.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, userId: true } });
  if (!officers.length) {
    const hash = await bcrypt.hash("pass@123", 10);
    for (const [i, [name, designation]] of [["Anitha Kumari", "Deputy Director"], ["Biju Varghese", "Assistant Director"], ["Shameer Ali", "Industries Extension Officer"], ["Rekha Nair", "Assistant Director"]].entries()) {
      await prisma.user.create({ data: { username: `nodal${two(i + 1)}`, passwordHash: hash, role: "NODAL", displayName: name,
        nodalOfficer: { create: { name, designation, mobile: `94470${String(10001 + i * 111).padStart(5, "0")}`, email: `nodal${i + 1}@industries.kerala.example` } } } });
    }
    officers = await prisma.nodalOfficer.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, userId: true } });
  }
  const seated = [...buyers].sort((a, b) => (a.requirement?.items[0]?.sector.sortOrder ?? 999) - (b.requirement?.items[0]?.sector.sortOrder ?? 999) || (a.approvedSeq ?? 0) - (b.approvedSeq ?? 0));
  const per = Math.ceil(seated.length / officers.length);
  const pavilion = new Map<string, number>(), nodalUser = new Map<string, string>();
  await prisma.buyer.updateMany({ data: { pavilionNo: null } });
  for (const [i, b] of seated.entries()) {
    const o = officers[Math.min(officers.length - 1, Math.floor(i / per))];
    pavilion.set(b.id, i + 1); nodalUser.set(b.id, o.userId);
    await prisma.buyer.update({ where: { id: b.id }, data: { pavilionNo: i + 1, nodalOfficerId: o.id } });
  }

  // 3. Buyer–seller mapping: sellers' preferences first, then sector fit; up to 10 sellers a buyer, 5 buyers a seller.
  await prisma.mou.deleteMany({});
  await prisma.buyerDayAttendance.deleteMany({});
  await prisma.scheduledMeeting.deleteMany({});
  await prisma.meeting.deleteMany({});
  await prisma.publishedMatch.deleteMany({});
  await prisma.match.deleteMany({});
  const prefs = await prisma.sellerPreference.findMany({ select: { sellerId: true, buyerId: true, rank: true } });
  const load = new Map<string, number>();
  const pairs: { buyerId: string; sellerId: string; source: MatchSource; score: number; slot: number; sectorId: string }[] = [];
  for (const [bi, b] of buyers.entries()) {
    const want = new Set((b.requirement?.items ?? []).map((i) => i.sectorId));
    const offers = sellers.map((s, si) => {
      const shared = s.products.filter((p) => want.has(p.sectorId));
      const pref = prefs.find((p) => p.sellerId === s.id && p.buyerId === b.id);
      return { s, shared, pref, order: (si + bi * 7) % sellers.length };
    }).filter((x) => x.shared.length && (load.get(x.s.id) ?? 0) < 5)
      .sort((x, y) => Number(!!y.pref) - Number(!!x.pref) || y.shared.length - x.shared.length || x.order - y.order)
      .slice(0, 10);
    for (const [k, x] of offers.entries()) {
      load.set(x.s.id, (load.get(x.s.id) ?? 0) + 1);
      pairs.push({ buyerId: b.id, sellerId: x.s.id, source: x.pref ? "PREFERENCE" : "SYSTEM", score: Math.round((90 - k * 3 + rand() * 8) * 10) / 10, slot: k + 1, sectorId: x.shared[0].sectorId });
    }
  }
  const version = Number((await prisma.matchSetting.findUnique({ where: { key: "version" } }))?.value ?? 0) + 1;
  await prisma.match.createMany({ data: pairs.map((p) => ({ buyerId: p.buyerId, sellerId: p.sellerId, source: p.source, score: p.score })) });
  await prisma.publishedMatch.createMany({ data: pairs.map((p) => ({ version, buyerId: p.buyerId, sellerId: p.sellerId, source: p.source, score: p.score, slot: p.slot })) });
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * MIN), weekAgo = new Date(now.getTime() - 7 * 24 * 60 * MIN);
  for (const [k, v] of [["buyersVisible", "true"], ["prefsFrozen", "true"], ["locked", "true"], ["interaction", "true"], ["version", String(version)],
    ["publishedAt", tenDaysAgo.toISOString()], ["generatedAt", tenDaysAgo.toISOString()]] as const) await setting(k, v);

  // 4. Schedule: each pair in the earliest slot free for both (round by round, pavilion order), then published with tickets.
  const slots = [...daySlots(today, 1, hm(start), hm(end), todayBreaks, len, buffer), ...daySlots(tomorrow, 2, "09:30", "16:30", tomorrowBreaks, len, buffer)];
  const busy = new Map<string, { startAt: Date; endAt: Date }[]>();
  const free = (who: string, s: Slot) => !(busy.get(who) ?? []).some((m) => clashes(m, s, buffer));
  const book = (who: string, s: Slot) => busy.set(who, [...(busy.get(who) ?? []), s]);
  const byBuyer = seated.map((b) => pairs.filter((p) => p.buyerId === b.id));
  const placed: { buyerId: string; sellerId: string; slot: Slot }[] = [];
  for (let r = 0; r < 10; r++) for (const list of byBuyer) {
    const p = list[r];
    if (!p) continue;
    const s = slots.find((x) => free(`b${p.buyerId}`, x) && free(`s${p.sellerId}`, x));
    if (!s) continue;
    book(`b${p.buyerId}`, s); book(`s${p.sellerId}`, s);
    placed.push({ buyerId: p.buyerId, sellerId: p.sellerId, slot: s });
  }
  const eventVersion = Number((await prisma.matchSetting.findUnique({ where: { key: "event.version" } }))?.value ?? 0) + 1;
  const seqOf = new Map(buyers.map((b) => [b.id, b.approvedSeq ?? 0]));
  const used = new Set<string>();
  const ticket = (dayNo: number, buyerId: string, at: Date) => {
    const pav = pavilion.get(buyerId);
    const base = `TX-D${dayNo}-${pav ? `P${two(pav)}` : `B${two(seqOf.get(buyerId) ?? 0)}`}-${hhmm(at)}`;
    let t = base;
    for (let i = 0; used.has(t); i++) t = `${base}-${"ABCDEFGHJKLMNPQRSTUVWXYZ"[i % 24]}${i >= 24 ? i : ""}`;
    used.add(t);
    return t;
  };
  await prisma.meeting.createMany({ data: placed.map((m) => ({ buyerId: m.buyerId, sellerId: m.sellerId, day: m.slot.day, startAt: m.slot.startAt, endAt: m.slot.endAt })) });
  await prisma.scheduledMeeting.createMany({ data: placed.map((m) => ({ ticketNo: ticket(m.slot.dayNo, m.buyerId, m.slot.startAt), buyerId: m.buyerId, sellerId: m.sellerId,
    day: m.slot.day, startAt: m.slot.startAt, endAt: m.slot.endAt, pavilionNo: pavilion.get(m.buyerId) ?? null, version: eventVersion })) });
  await setting("event.version", String(eventVersion));
  await setting("event.publishedAt", weekAgo.toISOString());
  await setting("event.generatedAt", weekAgo.toISOString());
  await prisma.matchEvent.createMany({ data: [
    { action: `Mapping published (version ${version})`, actorId: dic.id, detail: `${pairs.length} pairs`, createdAt: tenDaysAgo },
    { action: `Final mapping locked (version ${version})`, actorId: dic.id, createdAt: tenDaysAgo },
    { action: `Meeting schedule published (version ${eventVersion})`, actorId: dic.id, detail: `${placed.length} meetings`, createdAt: weekAgo },
  ] });

  // 5. Today's attendance, as the nodal officers would have marked it.
  type M = { id: string; buyerId: string; sellerId: string; ticketNo: string; startAt: Date; endAt: Date; status: MeetingStatus };
  const todays: M[] = await prisma.scheduledMeeting.findMany({ where: { day: today }, orderBy: [{ startAt: "asc" }, { ticketNo: "asc" }],
    select: { id: true, buyerId: true, sellerId: true, ticketNo: true, startAt: true, endAt: true, status: true } });
  const t = now.getTime();
  const lastEnded = Math.max(0, ...todays.filter((m) => m.endAt.getTime() <= t).map((m) => m.startAt.getTime()));
  const buyerAbsentFor = todays.find((m) => m.endAt.getTime() <= t && m.startAt.getTime() < lastEnded)?.buyerId; // one buyer came late
  const late = buyerAbsentFor ? todays.filter((m) => m.buyerId === buyerAbsentFor && m.endAt.getTime() <= t)[0] : undefined;
  const set = new Map<string, { status: MeetingStatus; markedAt: Date | null }>();
  const nth = new Map<number, number>(); // position of a meeting within its slot
  for (const m of todays) {
    const s = m.startAt.getTime(), e = m.endAt.getTime(), r = rand();
    const k = nth.get(s) ?? 0; nth.set(s, k + 1);
    let status: MeetingStatus = "SCHEDULED", at: Date | null = null;
    if (m === late) { status = "BUYER_ABSENT"; at = new Date(s + 5 * MIN); }
    else if (e <= t) {
      if (r < 0.06) { status = "SELLER_ABSENT"; at = new Date(s + 6 * MIN); }
      else if (s === lastEnded && k % 7 === 2) status = "SCHEDULED"; // not marked yet — shows under "needs attention"
      else { status = "COMPLETED"; at = new Date(e + Math.floor(rand() * 4) * MIN); }
    } else if (s <= t) {
      if (k % 8 === 3) status = "SCHEDULED"; // awaiting the seller — the slot can be filled
      else if (k % 11 === 6) { status = "SELLER_ABSENT"; at = new Date(Math.min(t, s + 6 * MIN)); }
      else { status = "SELLER_PRESENT"; at = new Date(s - Math.floor(3 + r * 8) * MIN); }
    } else if (s - t <= 40 * MIN && r < 0.45) { status = "SELLER_PRESENT"; at = new Date(Math.min(t, s - 8 * MIN)); } // checked in early
    m.status = status;
    set.set(m.id, { status, markedAt: at && at.getTime() > t ? now : at });
  }
  // A seller marked absent earlier keeps away for the rest of the day; their later meetings are absent too once due.
  const firstAbsence = new Map<string, number>();
  for (const m of todays) if (m.status === "SELLER_ABSENT" && !firstAbsence.has(m.sellerId)) firstAbsence.set(m.sellerId, m.startAt.getTime());
  const absentSellers = new Set(firstAbsence.keys());
  for (const m of todays) if (m.startAt.getTime() > (firstAbsence.get(m.sellerId) ?? Infinity) && m.startAt.getTime() <= t && m.status !== "SELLER_ABSENT" && m.status !== "BUYER_ABSENT") {
    m.status = "SELLER_ABSENT"; set.set(m.id, { status: "SELLER_ABSENT", markedAt: new Date(Math.min(t, m.startAt.getTime() + 6 * MIN)) });
  }
  for (const m of todays) {
    const v = set.get(m.id)!;
    if (v.status === "SCHEDULED") continue;
    await prisma.scheduledMeeting.update({ where: { id: m.id }, data: { status: v.status, markedAt: v.markedAt, markedById: nodalUser.get(m.buyerId) ?? dic.id } });
  }
  const buyersToday = [...new Set(todays.map((m) => m.buyerId))];
  await prisma.buyerDayAttendance.createMany({ data: buyersToday.map((b) => ({ buyerId: b, day: today, present: true, markedById: nodalUser.get(b) ?? dic.id,
    markedAt: new Date(Math.min(t, istAt(today, hm(start)).getTime() + (b === buyerAbsentFor ? 50 : 5) * MIN)) })) });

  // 6. Absent sellers' slots given to another matched seller of the buyer, free at that time (a later meeting moved forward).
  let fills = 0;
  const busyAt = (sellerId: string, exceptId: string) => todays.filter((m) => m.sellerId === sellerId && m.id !== exceptId && ["SCHEDULED", "SELLER_PRESENT", "COMPLETED"].includes(m.status));
  for (const target of todays.filter((m) => m.status === "SELLER_ABSENT" && m.startAt.getTime() <= t)) {
    if (fills >= 4) break;
    const slot = { startAt: target.startAt, endAt: target.endAt };
    const own = todays.find((m) => m.buyerId === target.buyerId && m.status === "SCHEDULED" && m.startAt.getTime() > t + 30 * MIN
      && !absentSellers.has(m.sellerId) && !busyAt(m.sellerId, m.id).some((x) => clashes(x, slot, buffer)));
    if (!own) continue;
    const ongoing = target.endAt.getTime() > t;
    const movedAt = new Date(Math.min(t, target.startAt.getTime() + 8 * MIN));
    const by = nodalUser.get(target.buyerId) ?? dic.id;
    await prisma.scheduledMeeting.update({ where: { id: own.id }, data: { startAt: target.startAt, endAt: target.endAt, status: ongoing ? "SELLER_PRESENT" : "COMPLETED",
      markedAt: ongoing ? movedAt : target.endAt, markedById: by, movedFrom: own.startAt, movedAt, movedById: by, replacesId: target.id } });
    await prisma.meeting.updateMany({ where: { buyerId: own.buyerId, sellerId: own.sellerId }, data: { startAt: target.startAt, endAt: target.endAt, manual: true } });
    // Draft, as the app does it: the absent pair takes the freed slot if it fits, else leaves the draft.
    const freed = { day: today, startAt: own.startAt, endAt: own.endAt };
    const draftOthers = await prisma.meeting.findMany({ where: { OR: [{ buyerId: target.buyerId }, { sellerId: target.sellerId }], NOT: { buyerId: target.buyerId, sellerId: target.sellerId } } });
    if (draftOthers.some((x) => clashes(x, freed, buffer))) await prisma.meeting.deleteMany({ where: { buyerId: target.buyerId, sellerId: target.sellerId } });
    else await prisma.meeting.updateMany({ where: { buyerId: target.buyerId, sellerId: target.sellerId }, data: { ...freed, manual: true } });
    const [b, s, a] = await Promise.all([
      prisma.buyer.findUnique({ where: { id: target.buyerId }, select: { name: true, pavilionNo: true } }),
      prisma.seller.findUnique({ where: { id: own.sellerId }, select: { name: true } }),
      prisma.seller.findUnique({ where: { id: target.sellerId }, select: { name: true } }),
    ]);
    await prisma.matchEvent.create({ data: { action: `Slot filled at pavilion ${b?.pavilionNo ?? "–"}, ${today} ${fmt(target.startAt)}`, actorId: by, createdAt: movedAt,
      detail: `${b?.name}: ${a?.name} absent; ${s?.name} moved forward from ${fmt(own.startAt)}` } });
    own.startAt = target.startAt; own.endAt = target.endAt; own.status = ongoing ? "SELLER_PRESENT" : "COMPLETED";
    fills++;
  }

  // 7. MoUs after about half of the completed meetings — older ones approved, the newest still with the reviewers.
  const done = await prisma.scheduledMeeting.findMany({ where: { day: today, status: "COMPLETED" }, orderBy: { endAt: "asc" },
    select: { id: true, buyerId: true, sellerId: true, endAt: true } });
  const GOODS_SUFFIX = ["export packs", "bulk, 25 kg bags", "private label", "retail packs", "trial order", "for the festive season"];
  const sellerById = new Map(sellers.map((s) => [s.id, s]));
  const buyerById = new Map(buyers.map((b) => [b.id, b]));
  const drafts: { buyerId: string; sellerId: string; meetingId: string; submittedAt: Date }[] = [];
  for (const m of done) {
    if (rand() > 0.55) continue;
    let at = m.endAt.getTime() + Math.floor(4 + rand() * 40) * MIN;
    if (at > t - MIN) at = t - Math.floor(1 + rand() * 12) * MIN;
    if (at < m.endAt.getTime()) at = m.endAt.getTime() + MIN;
    if (at > t) continue;
    drafts.push({ buyerId: m.buyerId, sellerId: m.sellerId, meetingId: m.id, submittedAt: new Date(at) });
  }
  drafts.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  // The newest few were filled minutes ago (they show as NEW on the MoU dashboard).
  for (const [k, ago] of [11, 6, 2].entries()) {
    const d = drafts[drafts.length - 3 + k];
    if (d && t - ago * MIN > d.submittedAt.getTime()) d.submittedAt = new Date(t - ago * MIN);
  }
  const counts: Record<MouStatus, number> = { APPROVED: 0, SUBMITTED: 0, RETURNED: 0, WITHDRAWN: 0 };
  for (const [i, d] of drafts.entries()) {
    const b = buyerById.get(d.buyerId)!, s = sellerById.get(d.sellerId)!;
    const want = new Set((b.requirement?.items ?? []).map((x) => x.sectorId));
    const prod = s.products.find((p) => want.has(p.sectorId)) ?? s.products[0];
    const goods = prod ? `${prod.products.split(/,\s*/).slice(0, 2).join(" and ")} — ${pick(GOODS_SUFFIX)}` : "Assorted products — trial order";
    const r = rand();
    const kind = r < 0.68 ? "USD" : r < 0.9 ? "INR" : "TBD";
    const amount = kind === "TBD" ? null : kind === "USD" ? pick([15000, 25000, 40000, 60000, 75000, 120000, 150000, 250000, 400000, 600000]) : pick([800000, 1500000, 2500000, 4200000, 6000000, 9000000, 15000000]);
    const age = (t - d.submittedAt.getTime()) / MIN;
    const q = rand();
    let status: MouStatus = "SUBMITTED";
    if (i === 3) status = "WITHDRAWN";
    else if (age > 75) status = q < 0.8 ? "APPROVED" : q < 0.9 ? "RETURNED" : "SUBMITTED";
    else if (age > 25) status = q < 0.35 ? "APPROVED" : "SUBMITTED";
    const sub = d.submittedAt.getTime();
    const nodalAt = new Date(Math.min(t, sub + Math.floor(8 + rand() * 20) * MIN));
    const fieoAt = new Date(Math.min(t, sub + Math.floor(12 + rand() * 30) * MIN));
    const partial = status === "SUBMITTED" && age > 15 ? rand() : 1; // with one of the two reviewers already
    const nodalBy = nodalUser.get(d.buyerId) ?? dic.id;
    const prior = await prisma.mou.count({ where: { buyerId: d.buyerId, sellerId: d.sellerId } });
    await prisma.mou.create({ data: {
      seq: i + 1, mouNo: `RBSM-MOU-${EVENT.approvedYear}-B${pad3(b.approvedSeq ?? 0)}-S${pad3(s.approvedSeq ?? 0)}${prior ? `-${prior + 1}` : ""}`,
      buyerId: d.buyerId, sellerId: d.sellerId, meetingId: d.meetingId, sectorId: prod?.sectorId ?? null, goods,
      currency: kind === "INR" ? "INR" : "USD", amount, orderMonth: istDay(new Date(t + (1 + Math.floor(rand() * 6)) * 31 * 24 * 60 * MIN)).slice(0, 7),
      status, submittedAt: d.submittedAt,
      ...(status === "APPROVED" ? { nodalVerifiedAt: nodalAt, nodalVerifiedById: nodalBy, fieoApprovedAt: fieoAt, fieoApprovedById: fieo.id, approvedAt: new Date(Math.max(nodalAt.getTime(), fieoAt.getTime())) } : {}),
      ...(partial < 0.4 ? { nodalVerifiedAt: nodalAt, nodalVerifiedById: nodalBy } : partial < 0.6 ? { fieoApprovedAt: fieoAt, fieoApprovedById: fieo.id } : {}),
      ...(status === "RETURNED" ? { returnComment: pick(["Please state the pack size and the quantity per order.", "Please give the value in US$ as agreed in the meeting.", "Please add the grade / count of the product."]),
        returnedAt: fieoAt, returnedById: pick([fieo.id, nodalBy]) } : {}),
    } });
    counts[status]++;
  }
  await prisma.counter.upsert({ where: { name: "mou" }, create: { name: "mou", value: drafts.length }, update: { value: drafts.length } });

  // Summary
  const all = await prisma.scheduledMeeting.findMany({ where: { day: today }, select: { status: true, startAt: true, endAt: true } });
  const by = (f: (m: (typeof all)[number]) => boolean) => all.filter(f).length;
  console.log(`Event day 1 is today (${today}), ${hm(start)}–${hm(end)} IST (now ${hm(nowMin)}); day 2 is tomorrow (${tomorrow}), 09:30–16:30.`);
  console.log(`Mapping: ${pairs.length} buyer–seller pairs (version ${version}, locked). Schedule version ${eventVersion}: ${placed.length} meetings (${todays.length} today).`);
  console.log(`Today so far: ${by((m) => m.status === "COMPLETED")} completed, ${by((m) => m.status === "SELLER_PRESENT" && m.startAt <= now && m.endAt > now)} in meeting now, `
    + `${by((m) => m.status === "SCHEDULED" && m.startAt <= now && m.endAt > now)} awaiting the seller, ${by((m) => m.status === "SELLER_ABSENT")} seller absent, `
    + `${by((m) => m.status === "BUYER_ABSENT")} buyer absent, ${by((m) => m.status === "SCHEDULED" && m.endAt <= now)} not marked, ${by((m) => m.startAt > now)} still to come; ${fills} slots filled.`);
  console.log(`MoUs: ${drafts.length} (${counts.APPROVED} approved, ${counts.SUBMITTED} with the reviewers, ${counts.RETURNED} returned, ${counts.WITHDRAWN} withdrawn).`);
  console.log("Logins: dic123 / dic123 (Directorate) · fieo / pass@123 · nodal01–nodal04 / pass@123 (nodal officers).");
}

main().finally(() => prisma.$disconnect());
