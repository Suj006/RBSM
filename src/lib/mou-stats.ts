import "server-only";
import { prisma } from "@/lib/prisma";
import { getMouRate, toMoney } from "@/lib/mou";
import { istDay } from "@/lib/event";

export type Agg = { key: string; label: string; count: number; usd: number; inr: number; tbd: number; sub?: string; country?: string };
const agg = () => new Map<string, Agg>();
function add(map: Map<string, Agg>, key: string, label: string, v: { usd: number; inr: number } | null, extra: Partial<Agg> = {}) {
  const a = map.get(key) ?? { key, label, count: 0, usd: 0, inr: 0, tbd: 0, ...extra };
  a.count++;
  if (v) { a.usd += v.usd; a.inr += v.inr; } else a.tbd++;
  map.set(key, a);
}
const sorted = (m: Map<string, Agg>) => [...m.values()].sort((a, b) => b.usd - a.usd || b.count - a.count || a.label.localeCompare(b.label));

/**
 * Everything on the MoU dashboard. `scope` "signed" = approved + awaiting verification (the default); "approved" = approved only.
 */
export async function mouStats(scope: "signed" | "approved" = "signed") {
  const [rate, all, approvedBuyers, approvedSellers, meetings] = await Promise.all([
    getMouRate(),
    prisma.mou.findMany({ orderBy: { submittedAt: "desc" }, include: {
      buyer: { select: { id: true, name: true, country: true, approvedNo: true, regNo: true, nodalOfficer: { select: { id: true, name: true } } } },
      seller: { select: { id: true, name: true, district: true, approvedNo: true, regNo: true } }, sector: { select: { id: true, name: true } } } }),
    prisma.buyer.count({ where: { status: "APPROVED" } }),
    prisma.seller.count({ where: { status: "APPROVED" } }),
    prisma.scheduledMeeting.groupBy({ by: ["status"], _count: true }),
  ]);
  const withMoney = all.map((m) => ({ ...m, money: toMoney(m, rate) }));
  const sum = (list: typeof withMoney) => list.reduce((s, m) => ({ usd: s.usd + (m.money?.usd ?? 0), inr: s.inr + (m.money?.inr ?? 0) }), { usd: 0, inr: 0 });
  const approved = withMoney.filter((m) => m.status === "APPROVED");
  const pending = withMoney.filter((m) => m.status === "SUBMITTED");
  const returned = withMoney.filter((m) => m.status === "RETURNED");
  const withdrawn = withMoney.filter((m) => m.status === "WITHDRAWN");
  const inScope = scope === "approved" ? approved : [...approved, ...pending];

  const byCountry = agg(), bySector = agg(), byBuyer = agg(), bySeller = agg(), byDistrict = agg(), byMonth = agg(), byDay = agg(), byNodal = agg(), byCurrency = agg();
  for (const m of inScope) {
    add(byCountry, m.buyer.country, m.buyer.country, m.money, { country: m.buyer.country });
    add(bySector, m.sector?.id ?? "-", m.sector?.name ?? "No sector", m.money);
    add(byBuyer, m.buyer.id, m.buyer.name, m.money, { sub: m.buyer.approvedNo ?? m.buyer.regNo, country: m.buyer.country });
    add(bySeller, m.seller.id, m.seller.name, m.money, { sub: `${m.seller.approvedNo ?? m.seller.regNo} · ${m.seller.district}` });
    add(byDistrict, m.seller.district, m.seller.district, m.money);
    add(byMonth, m.orderMonth, m.orderMonth, m.money);
    const d = istDay(m.submittedAt);
    add(byDay, d, d, m.money);
    add(byNodal, m.buyer.nodalOfficer?.id ?? "-", m.buyer.nodalOfficer?.name ?? "No nodal officer", m.money);
    add(byCurrency, m.amount === null ? "TBD" : m.currency, m.amount === null ? "Value to be determined" : m.currency === "USD" ? "Entered in US$" : "Entered in INR", m.money);
  }
  const valued = inScope.filter((m) => m.money);
  const biggest = [...valued].sort((a, b) => b.money!.usd - a.money!.usd)[0] ?? null;
  const meetingsDone = meetings.filter((g) => g.status === "COMPLETED" || g.status === "SELLER_PRESENT").reduce((n, g) => n + g._count, 0);
  const meetingsAll = meetings.filter((g) => g.status !== "CANCELLED").reduce((n, g) => n + g._count, 0);
  // Trend: today vs yesterday (IST), the last hour, and the running total day by day.
  const now = new Date();
  const today = istDay(now), yesterday = istDay(new Date(now.getTime() - 864e5));
  const onDay = (d: string) => inScope.filter((m) => istDay(m.submittedAt) === d);
  const days = [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key));
  let runCount = 0, runUsd = 0;
  const cumulative = days.map((d) => ({ key: d.key, count: (runCount += d.count), usd: (runUsd += d.usd) }));
  return {
    rate, scope, now: now.getTime(),
    trend: {
      today: { count: onDay(today).length, ...sum(onDay(today)) },
      yesterday: { count: onDay(yesterday).length, ...sum(onDay(yesterday)) },
      lastHour: inScope.filter((m) => now.getTime() - m.submittedAt.getTime() < 36e5).length,
      lastAt: inScope[0]?.submittedAt ?? null,
      cumulative,
    },
    totals: {
      approved: { count: approved.length, ...sum(approved), tbd: approved.filter((m) => !m.money).length },
      pending: { count: pending.length, ...sum(pending), awaitingNodal: pending.filter((m) => !m.nodalVerifiedAt).length, awaitingFieo: pending.filter((m) => !m.fieoApprovedAt).length },
      signed: { count: approved.length + pending.length, ...sum([...approved, ...pending]) },
      returned: returned.length, withdrawn: withdrawn.length,
      buyers: new Set(inScope.map((m) => m.buyerId)).size, approvedBuyers,
      sellers: new Set(inScope.map((m) => m.sellerId)).size, approvedSellers,
      countries: byCountry.size, districts: byDistrict.size,
      avgUsd: valued.length ? sum(valued).usd / valued.length : 0,
      tbd: inScope.filter((m) => !m.money).length,
      meetingsDone, meetingsAll, withMeeting: inScope.filter((m) => m.meetingId).length,
    },
    biggest,
    byCountry: sorted(byCountry), bySector: sorted(bySector), byBuyer: sorted(byBuyer).slice(0, 10), bySeller: sorted(bySeller).slice(0, 10),
    byDistrict: sorted(byDistrict), byNodal: sorted(byNodal), byCurrency: sorted(byCurrency),
    byMonth: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byDay: days.slice(-14),
    recent: withMoney.filter((m) => m.status !== "WITHDRAWN").slice(0, 24),
  };
}
export type MouStats = Awaited<ReturnType<typeof mouStats>>;
