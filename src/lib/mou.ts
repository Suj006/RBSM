import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MouStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { EVENT, pad3 } from "@/lib/config";

/* ------------------------------------------------------------------ numbers and money */

export const MOU_RATE_KEY = "mou.usdInr";
export const DEFAULT_RATE = 88;

/** Exchange rate used to show every MoU value in both US$ and INR (set by the Directorate). */
export async function getMouRate() {
  const r = await prisma.matchSetting.findUnique({ where: { key: MOU_RATE_KEY } });
  const v = Number(r?.value);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_RATE;
}

/** RBSM-MOU-2026-B007-S012 — year, the buyer's and the seller's approved numbers; "-2", "-3" for further MoUs of the pair. */
export const mouNumber = (buyerSeq: number, sellerSeq: number, n = 1) =>
  `RBSM-MOU-${EVENT.approvedYear}-B${pad3(buyerSeq)}-S${pad3(sellerSeq)}${n > 1 ? `-${n}` : ""}`;

export type Money = { usd: number; inr: number } | null;
export const toMoney = (m: { amount: number | null; currency: string }, rate: number): Money =>
  m.amount === null ? null : m.currency === "INR" ? { inr: m.amount, usd: m.amount / rate } : { usd: m.amount, inr: m.amount * rate };

/** US$ 1,250,000 / ₹ 1,10,00,000 */
export const fmtUsd = (v: number) => `US$ ${Math.round(v).toLocaleString("en-US")}`;
export const fmtInr = (v: number) => `₹ ${Math.round(v).toLocaleString("en-IN")}`;
/** Compact: $1.25M, ₹11.0 Cr, ₹8.4 L */
export const shortUsd = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}K` : `$${Math.round(v)}`;
export const shortInr = (v: number) => v >= 1e7 ? `₹${(v / 1e7).toFixed(v >= 1e9 ? 0 : 2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : `₹${Math.round(v).toLocaleString("en-IN")}`;

/** "2026-05" → "May 2026" */
export const fmtMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return y && mo ? new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : m;
};

export const MOU_STATUS: Record<MouStatus, { label: string; tone: "green" | "amber" | "red" | "slate" | "blue" }> = {
  SUBMITTED: { label: "Awaiting verification", tone: "amber" },
  RETURNED: { label: "Returned to buyer", tone: "red" },
  APPROVED: { label: "Approved", tone: "green" },
  WITHDRAWN: { label: "Withdrawn", tone: "slate" },
};

/** Where a submitted MoU stands with the two reviewers. */
export const mouStage = (m: { status: MouStatus; nodalVerifiedAt: Date | null; fieoApprovedAt: Date | null }) =>
  m.status !== "SUBMITTED" ? MOU_STATUS[m.status].label
    : !m.nodalVerifiedAt && !m.fieoApprovedAt ? "With nodal officer and FIEO"
    : !m.nodalVerifiedAt ? "Approved by FIEO — awaiting nodal officer"
    : "Verified by nodal officer — awaiting FIEO";

/** Short form for tables: "Awaiting FIEO", "Awaiting nodal officer", "Awaiting both". */
export const mouStageShort = (m: { status: MouStatus; nodalVerifiedAt: Date | null; fieoApprovedAt: Date | null }) =>
  m.status !== "SUBMITTED" ? MOU_STATUS[m.status].label
    : !m.nodalVerifiedAt && !m.fieoApprovedAt ? "Awaiting both checks" : !m.nodalVerifiedAt ? "Awaiting nodal officer" : "Awaiting FIEO";

/* ------------------------------------------------------------------ who can sign with whom */

/**
 * Sellers an approved buyer can sign an MoU with: the buyer's matched sellers (published mapping) and any seller
 * met in a scheduled meeting — with the sectors both share and the meeting, if any.
 */
export async function mouPartners(buyerId: string) {
  const [buyer, pairs, meetings] = await Promise.all([
    prisma.buyer.findUnique({ where: { id: buyerId }, select: { requirement: { select: { items: { where: { status: "APPROVED" }, select: { sectorId: true } } } } } }),
    prisma.publishedMatch.findMany({ where: { buyerId }, orderBy: { slot: "asc" }, select: { sellerId: true } }),
    prisma.scheduledMeeting.findMany({ where: { buyerId }, select: { id: true, sellerId: true, day: true, startAt: true, ticketNo: true, status: true } }),
  ]);
  const ids = [...new Set([...pairs.map((p) => p.sellerId), ...meetings.map((m) => m.sellerId)])];
  const sellers = await prisma.seller.findMany({ where: { id: { in: ids }, status: "APPROVED" },
    select: { id: true, name: true, district: true, approvedNo: true, regNo: true, approvedSeq: true, products: { orderBy: { sortOrder: "asc" }, select: { products: true, sectorId: true, sector: { select: { id: true, name: true } } } } } });
  const mine = new Set((buyer?.requirement?.items ?? []).map((i) => i.sectorId));
  return sellers.map((s) => ({
    ...s,
    commonSectors: s.products.filter((p) => mine.has(p.sectorId)).map((p) => p.sector),
    meeting: meetings.find((m) => m.sellerId === s.id) ?? null,
  })).sort((a, b) => Number(!!b.meeting) - Number(!!a.meeting) || a.name.localeCompare(b.name));
}
export type MouPartner = Awaited<ReturnType<typeof mouPartners>>[number];

/** Everything shown on the MoU document and pages. */
export const MOU_INCLUDE = {
  buyer: { select: { id: true, name: true, country: true, approvedNo: true, regNo: true, pocName: true, pocDesignation: true, pocEmail: true, pocMobile: true, nodalOfficerId: true,
    nodalOfficer: { select: { userId: true, name: true } }, user: { select: { username: true } } } },
  seller: { select: { id: true, name: true, district: true, approvedNo: true, regNo: true, contactName: true, contactMobile: true, contactEmail: true, iecNo: true, udyamNo: true, taluk: true } },
  sector: { select: { name: true } },
  meeting: { select: { ticketNo: true, day: true, startAt: true, pavilionNo: true } },
  nodalVerifiedBy: { select: { displayName: true } },
  fieoApprovedBy: { select: { displayName: true } },
  returnedBy: { select: { displayName: true, role: true } },
} as const;
export const loadMou = (id: string) => prisma.mou.findUnique({ where: { id }, include: MOU_INCLUDE });
export type FullMou = NonNullable<Awaited<ReturnType<typeof loadMou>>>;

/* ------------------------------------------------------------------ filters */

export type MouFilters = { q?: string; status?: string; country?: string; sector?: string; district?: string; stage?: string };

export function mouWhere(f: MouFilters, scope: Prisma.MouWhereInput = {}): Prisma.MouWhereInput {
  const and: Prisma.MouWhereInput[] = [scope];
  const q = f.q?.trim();
  if (q) and.push({ OR: [{ mouNo: { contains: q } }, { goods: { contains: q } }, { buyer: { name: { contains: q } } }, { buyer: { approvedNo: { contains: q } } },
    { seller: { name: { contains: q } } }, { seller: { approvedNo: { contains: q } } }] });
  if (f.status && (Object.keys(MOU_STATUS) as string[]).includes(f.status)) and.push({ status: f.status as MouStatus });
  if (f.stage === "nodal") and.push({ status: "SUBMITTED", nodalVerifiedAt: null });
  if (f.stage === "fieo") and.push({ status: "SUBMITTED", fieoApprovedAt: null });
  if (f.country) and.push({ buyer: { country: f.country } });
  if (f.sector) and.push({ sectorId: f.sector });
  if (f.district) and.push({ seller: { district: f.district } });
  return { AND: and };
}

