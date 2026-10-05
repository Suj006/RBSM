"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { EVENT } from "@/lib/config";
import {
  allSlots, assignNodalOfficers, assignPavilions, clashes, fmtDay, fmtTime, generateSchedule, getEventConfig, isDay, isTime, minutes,
  setEventSetting, ticketNo, type Break,
} from "@/lib/event";
import { eventMail, sendMail } from "@/lib/mail";
import { emailField, indianMobile, personName, designation as designationField } from "@/lib/text";
import { logMatchEvent } from "@/lib/matchmaking";
import type { MeetingStatus } from "@/generated/prisma/enums";
import type { FormState } from "./auth";

const revalidateAll = () => {
  for (const p of ["/dic", "/fieo", "/admin", "/buyer", "/seller", "/nodal"]) revalidatePath(p, "layout");
};
const ok = (message: string): FormState => { revalidateAll(); return { ok: true, message }; };
const DEFAULT_BREAKS: Break[] = [{ label: "Lunch break", start: "13:00", end: "14:00" }];

/* ------------------------------------------------------------------ event days */

/** Directorate: event start and end dates (one row per day; new days get 09:30–17:30 with a lunch break). */
export async function setEventDatesAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("DIC");
  const from = String(form.get("startDate") ?? ""), to = String(form.get("endDate") ?? "");
  if (!isDay(from) || !isDay(to)) return { fieldErrors: { startDate: "Enter both dates." } };
  const a = Date.parse(from), b = Date.parse(to);
  if (b < a) return { fieldErrors: { endDate: "The end date cannot be before the start date." } };
  const n = Math.round((b - a) / 864e5) + 1;
  if (n > 7) return { fieldErrors: { endDate: "The event can be at most 7 days." } };
  const dates = Array.from({ length: n }, (_, i) => new Date(a + i * 864e5).toISOString().slice(0, 10));
  await prisma.$transaction([
    prisma.eventDay.deleteMany({ where: { date: { notIn: dates } } }),
    ...dates.map((date) => prisma.eventDay.upsert({ where: { date }, create: { date, startTime: "09:30", endTime: "17:30", breaks: JSON.stringify(DEFAULT_BREAKS) }, update: {} })),
  ]);
  await logMatchEvent(`Event dates set: ${fmtDay(from)} – ${fmtDay(to)}`, user.id);
  return ok(`Event dates saved: ${n} day${n > 1 ? "s" : ""}. Set each day's hours and breaks below.`);
}

/** Directorate: meeting length, buffer, venue, and each day's hours and breaks (up to 3 per day). */
export async function saveEventDaysAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("DIC");
  const meeting = Number(form.get("meetingMinutes")), buffer = Number(form.get("bufferMinutes"));
  const fe: Record<string, string> = {};
  if (!Number.isInteger(meeting) || meeting < 10 || meeting > 120) fe.meetingMinutes = "Between 10 and 120 minutes.";
  if (!Number.isInteger(buffer) || buffer < 0 || buffer > 60) fe.bufferMinutes = "Between 0 and 60 minutes.";
  const venue = String(form.get("venue") ?? "").trim().slice(0, 200);
  const days = await prisma.eventDay.findMany({ orderBy: { date: "asc" } });
  const updates: { id: string; startTime: string; endTime: string; breaks: Break[] }[] = [];
  for (const d of days) {
    const st = String(form.get(`start-${d.date}`) ?? ""), en = String(form.get(`end-${d.date}`) ?? "");
    if (!isTime(st) || !isTime(en) || minutes(en) <= minutes(st)) { fe[`day-${d.date}`] = "Enter a start time before the end time."; continue; }
    const breaks: Break[] = [];
    for (let i = 0; i < 3; i++) {
      const bs = String(form.get(`bstart${i}-${d.date}`) ?? ""), be = String(form.get(`bend${i}-${d.date}`) ?? "");
      const label = String(form.get(`blabel${i}-${d.date}`) ?? "").trim().slice(0, 60) || "Break";
      if (!bs && !be) continue;
      if (!isTime(bs) || !isTime(be) || minutes(be) <= minutes(bs)) { fe[`day-${d.date}`] = `Break ${i + 1}: enter a start time before the end time.`; continue; }
      if (minutes(bs) < minutes(st) || minutes(be) > minutes(en)) { fe[`day-${d.date}`] = `Break ${i + 1} must be within the day's hours.`; continue; }
      breaks.push({ label, start: bs, end: be });
    }
    updates.push({ id: d.id, startTime: st, endTime: en, breaks: breaks.sort((x, y) => minutes(x.start) - minutes(y.start)) });
  }
  if (Object.keys(fe).length) return { fieldErrors: fe, error: "Please correct the highlighted fields." };
  await prisma.$transaction(updates.map((u) => prisma.eventDay.update({ where: { id: u.id }, data: { startTime: u.startTime, endTime: u.endTime, breaks: JSON.stringify(u.breaks) } })));
  await setEventSetting("event.meetingMinutes", String(meeting));
  await setEventSetting("event.bufferMinutes", String(buffer));
  await setEventSetting("event.venue", venue);
  const cfg = await getEventConfig();
  const n = allSlots(cfg).length;
  await logMatchEvent("Event hours and breaks updated", user.id, `${n} slots`);
  const drafts = await prisma.meeting.count();
  return ok(`Saved: ${n} meeting slots over ${cfg.days.length} day${cfg.days.length > 1 ? "s" : ""}.${drafts ? " Regenerate the draft schedule so it follows the new times." : ""}`);
}

/* ------------------------------------------------------------------ pavilions */

export async function pavilionAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("DIC");
  const op = String(form.get("op"));
  if (op === "auto") {
    const n = await assignPavilions();
    await logMatchEvent("Pavilions allocated by sector", user.id, `${n} buyers`);
    return ok(`Pavilions 1–${n} allocated: buyers grouped by their first sector (in the sector master's order).`);
  }
  if (op === "set") {
    const buyerId = String(form.get("buyerId") ?? "");
    const raw = String(form.get("pavilionNo") ?? "").trim();
    const no = raw ? Number(raw) : null;
    if (no !== null && (!Number.isInteger(no) || no < 1 || no > 999)) return { error: "Pavilion number: 1 to 999." };
    if (no !== null) {
      const taken = await prisma.buyer.findFirst({ where: { pavilionNo: no, id: { not: buyerId } }, select: { name: true } });
      if (taken) return { error: `Pavilion ${no} is already given to ${taken.name}.` };
    }
    await prisma.buyer.update({ where: { id: buyerId }, data: { pavilionNo: no } });
    return ok(no ? `Pavilion ${no} saved.` : "Pavilion cleared.");
  }
  return { error: "Unknown action." };
}

/* ------------------------------------------------------------------ nodal officers */

export async function createNodalAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("DIC");
  const name = personName("Name").safeParse(String(form.get("name") ?? ""));
  const desig = designationField("Designation").safeParse(String(form.get("designation") ?? ""));
  const mobile = indianMobile().safeParse(String(form.get("mobile") ?? ""));
  const email = emailField().safeParse(String(form.get("email") ?? ""));
  const fe: Record<string, string> = {};
  if (!name.success) fe.name = name.error.issues[0].message;
  if (!desig.success) fe.designation = desig.error.issues[0].message;
  if (!mobile.success) fe.mobile = mobile.error.issues[0].message;
  if (!email.success) fe.email = email.error.issues[0].message;
  if (Object.keys(fe).length) return { fieldErrors: fe, error: "Please correct the highlighted fields." };
  const count = await prisma.user.count({ where: { role: "NODAL" } });
  let n = count + 1, username = `nodal${String(n).padStart(2, "0")}`;
  while (await prisma.user.findUnique({ where: { username } })) username = `nodal${String(++n).padStart(2, "0")}`;
  const passwordHash = await hashPassword(EVENT.defaultBuyerPassword);
  await prisma.user.create({ data: { username, passwordHash, role: "NODAL", displayName: name.data!, mustChangePassword: true,
    nodalOfficer: { create: { name: name.data!, designation: desig.data || null, mobile: mobile.data!, email: email.data! } } } });
  const m = eventMail.nodalLogin(name.data!, username, EVENT.defaultBuyerPassword);
  await sendMail(email.data!, m.subject, m.text);
  await logMatchEvent("Nodal officer added", user.id, `${name.data} (${username})`);
  return ok(`${name.data} added — login ${username} (password e-mailed; to be changed at first sign-in).`);
}

export async function nodalAssignAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("DIC");
  const op = String(form.get("op"));
  if (op === "auto") {
    const n = await assignNodalOfficers();
    if (!n) return { error: "Add nodal officers first." };
    await logMatchEvent("Buyers shared among nodal officers", user.id, `${n} buyers`);
    return ok(`${n} buyers shared among the nodal officers in pavilion order.`);
  }
  if (op === "set") {
    const buyerId = String(form.get("buyerId") ?? ""), officerId = String(form.get("officerId") ?? "") || null;
    await prisma.buyer.update({ where: { id: buyerId }, data: { nodalOfficerId: officerId } });
    return ok("Nodal officer saved.");
  }
  if (op === "remove") {
    const id = String(form.get("officerId") ?? "");
    const o = await prisma.nodalOfficer.findUnique({ where: { id } });
    if (!o) return { error: "Not found." };
    await prisma.user.update({ where: { id: o.userId }, data: { isActive: false } });
    await prisma.buyer.updateMany({ where: { nodalOfficerId: id }, data: { nodalOfficerId: null } });
    await prisma.nodalOfficer.delete({ where: { id } });
    return ok(`${o.name} removed; the login is deactivated and the buyers are unassigned.`);
  }
  return { error: "Unknown action." };
}

/* ------------------------------------------------------------------ schedule */

export async function scheduleAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("DIC");
  const op = String(form.get("op"));
  const cfg = await getEventConfig();
  if (op === "fill" || op === "rebuild") {
    const pairs = await prisma.publishedMatch.count();
    if (!pairs) return { error: "Publish the buyer–seller mapping first — the schedule is built from it." };
    const r = await generateSchedule(op);
    if (r.error) return { error: r.error };
    await logMatchEvent(op === "fill" ? "Draft schedule filled" : "Draft schedule rebuilt", user.id, `${r.placed} placed, ${r.unplaced} not placed`);
    return ok(`${r.placed} meeting${r.placed === 1 ? "" : "s"} placed${r.kept ? `, ${r.kept} kept` : ""}.${r.unplaced ? ` ${r.unplaced} could not be placed — add more hours or days, or place them by hand.` : " Every pair has a slot."}`);
  }
  if (op === "publish") {
    const draft = await prisma.meeting.findMany({ include: { buyer: { select: { pavilionNo: true, approvedSeq: true } } } });
    if (!draft.length) return { error: "The draft schedule is empty." };
    const dayNo = new Map(cfg.days.map((d) => [d.date, d.n]));
    const prev = await prisma.scheduledMeeting.findMany();
    const version = cfg.version + 1;
    const key = (x: { buyerId: string; sellerId: string }) => `${x.buyerId}|${x.sellerId}`;
    const inDraft = new Set(draft.map(key));
    const changed = new Set<string>(); // participant ids to notify
    await prisma.$transaction(async (tx) => {
      // Removed meetings
      for (const p of prev.filter((x) => !inDraft.has(key(x)))) { changed.add(p.buyerId); changed.add(p.sellerId); await tx.scheduledMeeting.delete({ where: { id: p.id } }); }
      // Pass 1: write every meeting with a temporary ticket number; pass 2: final numbers (no clash with old ones).
      for (const m of draft) {
        const old = prev.find((x) => key(x) === key(m));
        if (!old || old.startAt.getTime() !== m.startAt.getTime() || old.pavilionNo !== m.buyer.pavilionNo) { changed.add(m.buyerId); changed.add(m.sellerId); }
        await tx.scheduledMeeting.upsert({
          where: { buyerId_sellerId: { buyerId: m.buyerId, sellerId: m.sellerId } },
          create: { ticketNo: `tmp-${m.id}`, buyerId: m.buyerId, sellerId: m.sellerId, day: m.day, startAt: m.startAt, endAt: m.endAt, pavilionNo: m.buyer.pavilionNo, version },
          update: { ticketNo: `tmp-${m.id}`, day: m.day, startAt: m.startAt, endAt: m.endAt, pavilionNo: m.buyer.pavilionNo, version,
            ...(old && old.startAt.getTime() !== m.startAt.getTime() ? { status: "SCHEDULED", markedAt: null, markedById: null } : {}) },
        });
      }
      for (const m of draft) {
        await tx.scheduledMeeting.update({ where: { buyerId_sellerId: { buyerId: m.buyerId, sellerId: m.sellerId } },
          data: { ticketNo: ticketNo(dayNo.get(m.day) ?? 0, m.buyer.pavilionNo, m.buyer.approvedSeq, m.startAt) } });
      }
    }, { timeout: 60000 });
    await setEventSetting("event.version", String(version));
    await setEventSetting("event.publishedAt", new Date().toISOString());
    await logMatchEvent(`Meeting schedule published (version ${version})`, user.id, `${draft.length} meetings`);
    // Tell buyers and sellers whose meetings are new or changed.
    const [buyers, sellers] = await Promise.all([
      prisma.buyer.findMany({ where: { id: { in: [...changed] } }, select: { name: true, approvedNo: true, regNo: true, signupEmail: true, pocEmail: true, _count: { select: { scheduled: true } } } }),
      prisma.seller.findMany({ where: { id: { in: [...changed] } }, select: { name: true, approvedNo: true, regNo: true, contactEmail: true, _count: { select: { scheduled: true } } } }),
    ]);
    for (const b of buyers) { const m = eventMail.schedule(b.name, b.approvedNo ?? b.regNo, b._count.scheduled, "/buyer/meetings", version > 1, false); await sendMail(b.pocEmail || b.signupEmail, m.subject, m.text); }
    for (const s of sellers) { const m = eventMail.schedule(s.name, s.approvedNo ?? s.regNo, s._count.scheduled, "/seller/meetings", version > 1, true); await sendMail(s.contactEmail, m.subject, m.text); }
    return ok(`Schedule version ${version} published: ${draft.length} meetings with tickets. ${changed.size} buyers / sellers informed by e-mail.`);
  }
  if (op === "clear") {
    await prisma.meeting.deleteMany({});
    return ok("Draft schedule cleared.");
  }
  return { error: "Unknown action." };
}

/** Directorate: move a draft meeting, remove it, or place an unscheduled pair. Slot = ISO start time. */
export async function meetingEditAction(_: FormState, form: FormData): Promise<FormState> {
  await requireUser("DIC");
  const op = String(form.get("op"));
  const cfg = await getEventConfig();
  if (op === "remove") {
    await prisma.meeting.delete({ where: { id: String(form.get("meetingId")) } }).catch(() => null);
    return ok("Meeting removed from the draft. The pair is listed under 'Not scheduled'.");
  }
  const start = new Date(String(form.get("slot") ?? ""));
  const slot = allSlots(cfg).find((s) => s.startAt.getTime() === start.getTime());
  if (!slot) return { error: "Choose a slot." };
  let buyerId: string, sellerId: string, exceptId: string | undefined;
  if (op === "move") {
    const m = await prisma.meeting.findUnique({ where: { id: String(form.get("meetingId")) } });
    if (!m) return { error: "Meeting not found." };
    ({ buyerId, sellerId } = m); exceptId = m.id;
  } else if (op === "place") {
    buyerId = String(form.get("buyerId")); sellerId = String(form.get("sellerId"));
    if (!(await prisma.publishedMatch.findFirst({ where: { buyerId, sellerId } }))) return { error: "This pair is not in the published mapping." };
  } else return { error: "Unknown action." };
  const others = await prisma.meeting.findMany({ where: { OR: [{ buyerId }, { sellerId }], ...(exceptId ? { id: { not: exceptId } } : {}) },
    include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } });
  const clash = others.find((m) => clashes(m, slot, cfg.bufferMinutes));
  if (clash) return { error: `Clash: ${clash.buyerId === buyerId ? clash.buyer.name : clash.seller.name} already has a meeting at ${fmtTime(clash.startAt)} (${fmtDay(clash.day)}).` };
  if (op === "move") await prisma.meeting.update({ where: { id: exceptId }, data: { day: slot.day, startAt: slot.startAt, endAt: slot.endAt, manual: true } });
  else await prisma.meeting.upsert({ where: { buyerId_sellerId: { buyerId, sellerId } }, create: { buyerId, sellerId, day: slot.day, startAt: slot.startAt, endAt: slot.endAt, manual: true },
    update: { day: slot.day, startAt: slot.startAt, endAt: slot.endAt, manual: true } });
  return ok(`Meeting set for ${fmtDay(slot.day)}, ${fmtTime(slot.startAt)}.`);
}

/* ------------------------------------------------------------------ event day: attendance */

const MARKS: MeetingStatus[] = ["SCHEDULED", "SELLER_PRESENT", "SELLER_ABSENT", "BUYER_ABSENT", "COMPLETED", "CANCELLED"];

/** Nodal officer (own buyers) or Directorate: mark a meeting — by id or ticket number. */
export async function markMeetingAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["NODAL", "DIC"]);
  const status = String(form.get("status")) as MeetingStatus;
  if (!MARKS.includes(status) || (status === "CANCELLED" && user.role !== "DIC")) return { error: "Unknown status." };
  const id = String(form.get("meetingId") ?? "");
  const tn = String(form.get("ticketNo") ?? "").trim().toUpperCase();
  const m = await prisma.scheduledMeeting.findFirst({ where: id ? { id } : { ticketNo: tn }, include: { buyer: { select: { name: true, nodalOfficer: { select: { userId: true } } } }, seller: { select: { name: true } } } });
  if (!m) return { error: "No meeting with this ticket number." };
  if (user.role === "NODAL" && m.buyer.nodalOfficer?.userId !== user.id) return { error: "This meeting is with a buyer assigned to another nodal officer." };
  const note = String(form.get("note") ?? "").trim().slice(0, 300) || null;
  await prisma.scheduledMeeting.update({ where: { id: m.id }, data: { status, markedAt: status === "SCHEDULED" ? null : new Date(), markedById: status === "SCHEDULED" ? null : user.id, ...(note ? { note } : {}) } });
  const verb: Record<MeetingStatus, string> = { SCHEDULED: "reset to scheduled", SELLER_PRESENT: "seller present — meeting can start", SELLER_ABSENT: "seller absent", BUYER_ABSENT: "buyer absent", COMPLETED: "completed", CANCELLED: "cancelled" };
  return ok(`${m.ticketNo} (${m.seller.name} with ${m.buyer.name}): ${verb[status]}.`);
}

/** Nodal officer / Directorate: a buyer present or absent for a day (absent marks that day's open meetings). */
export async function buyerDayAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["NODAL", "DIC"]);
  const buyerId = String(form.get("buyerId")), day = String(form.get("day"));
  const present = form.get("present") === "yes";
  const b = await prisma.buyer.findUnique({ where: { id: buyerId }, select: { name: true, nodalOfficer: { select: { userId: true } } } });
  if (!b) return { error: "Buyer not found." };
  if (user.role === "NODAL" && b.nodalOfficer?.userId !== user.id) return { error: "This buyer is assigned to another nodal officer." };
  await prisma.buyerDayAttendance.upsert({ where: { buyerId_day: { buyerId, day } }, create: { buyerId, day, present, markedById: user.id }, update: { present, markedById: user.id, markedAt: new Date() } });
  if (!present) await prisma.scheduledMeeting.updateMany({ where: { buyerId, day, status: "SCHEDULED" }, data: { status: "BUYER_ABSENT", markedAt: new Date(), markedById: user.id } });
  else await prisma.scheduledMeeting.updateMany({ where: { buyerId, day, status: "BUYER_ABSENT" }, data: { status: "SCHEDULED", markedAt: null, markedById: null } });
  return ok(`${b.name}: ${present ? "present" : "absent"} on ${fmtDay(day)}.`);
}
