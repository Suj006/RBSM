import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CONSTITUTIONS, DISTRICT_NAMES, GENDERS, SOCIAL_CATEGORIES, UNIT_CATEGORIES, UNIT_TYPES } from "@/lib/config";
import { parseCerts } from "@/lib/format";

type Opt = { readonly value: string; readonly label: string };
const count = <T,>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;
const breakdown = (rows: { v: string | null }[], opts: readonly Opt[]) =>
  opts.map((o) => ({ value: o.value, label: o.label, n: count(rows, (r) => r.v === o.value) }));

/**
 * Profile of the approved sellers in scope (from the profile each seller completes after approval) and
 * certification readiness: certifications approved buyer sectors require against approved sellers holding them.
 */
export async function sellerProfileStats(scope: Prisma.SellerWhereInput = {}, districts: readonly string[] = DISTRICT_NAMES) {
  const [sellers, items, buyerCountries] = await Promise.all([
    prisma.seller.findMany({
      where: { AND: [scope, { status: "APPROVED" }] },
      select: { district: true, exportExperience: true, exportCountries: true, iecNo: true, certifications: true, promoterGender: true, socialCategory: true,
        speciallyAbled: true, constitution: true, unitCategory: true, unitType: true, profileCompletedAt: true,
        products: { select: { sectorId: true } } },
    }),
    prisma.requirementItem.findMany({ where: { status: "APPROVED" }, select: { sectorId: true, certifications: true, sector: { select: { name: true } } } }),
    prisma.buyer.groupBy({ by: ["country"], where: { status: "APPROVED" }, _count: true }),
  ]);
  const done = sellers.filter((s) => s.profileCompletedAt);
  const certsOf = sellers.map((s) => ({ s, certs: parseCerts(s.certifications).map((c) => c.toLowerCase()) }));

  const summary = {
    approved: sellers.length, completed: done.length, pending: sellers.length - done.length,
    women: count(done, (s) => s.promoterGender === "FEMALE"),
    scst: count(done, (s) => s.socialCategory === "SC" || s.socialCategory === "ST"),
    disabled: count(done, (s) => s.speciallyAbled === true),
    withIec: count(sellers, (s) => !!s.iecNo),
    expNoIec: count(sellers, (s) => s.exportExperience && !s.iecNo),
    certified: count(certsOf, (x) => x.certs.length > 0),
  };
  const dims = {
    gender: breakdown(done.map((s) => ({ v: s.promoterGender })), GENDERS),
    social: breakdown(done.map((s) => ({ v: s.socialCategory })), SOCIAL_CATEGORIES),
    constitution: breakdown(done.map((s) => ({ v: s.constitution })), CONSTITUTIONS),
    category: breakdown(done.map((s) => ({ v: s.unitCategory })), UNIT_CATEGORIES),
    unitType: breakdown(done.map((s) => ({ v: s.unitType })), UNIT_TYPES),
  };
  const byDistrict = districts.map((d) => {
    const ds = sellers.filter((s) => s.district === d);
    const dd = ds.filter((s) => s.profileCompletedAt);
    return {
      district: d, approved: ds.length, completed: dd.length, pending: ds.length - dd.length,
      women: count(dd, (s) => s.promoterGender === "FEMALE"), scst: count(dd, (s) => s.socialCategory === "SC" || s.socialCategory === "ST"),
      disabled: count(dd, (s) => s.speciallyAbled === true),
      micro: count(dd, (s) => s.unitCategory === "MICRO"), small: count(dd, (s) => s.unitCategory === "SMALL"),
      medium: count(dd, (s) => s.unitCategory === "MEDIUM"), large: count(dd, (s) => s.unitCategory === "LARGE"),
      mfg: count(dd, (s) => s.unitType === "MANUFACTURING"), service: count(dd, (s) => s.unitType === "SERVICE"), trade: count(dd, (s) => s.unitType === "TRADE"),
      withIec: count(ds, (s) => !!s.iecNo), certified: count(ds, (s) => parseCerts(s.certifications).length > 0),
    };
  });

  // Certification readiness: approved buyer sectors asking for a certification vs approved sellers holding it.
  const need = new Map<string, { name: string; buyerSectors: number; sectorIds: Set<string>; sectors: Set<string> }>();
  for (const i of items) for (const c of parseCerts(i.certifications)) {
    const k = c.toLowerCase();
    const e = need.get(k) ?? { name: c, buyerSectors: 0, sectorIds: new Set<string>(), sectors: new Set<string>() };
    e.buyerSectors++; e.sectorIds.add(i.sectorId); e.sectors.add(i.sector.name);
    need.set(k, e);
  }
  const certReadiness = [...need.entries()].map(([k, e]) => {
    const holders = certsOf.filter((x) => x.certs.includes(k));
    const inSector = holders.filter((x) => x.s.products.some((p) => e.sectorIds.has(p.sectorId))).length;
    return { name: e.name, buyerSectors: e.buyerSectors, sectors: [...e.sectors].sort(), holders: holders.length, inSector };
  }).sort((a, b) => a.inSector - b.inSector || b.buyerSectors - a.buyerSectors || a.name.localeCompare(b.name));

  // Export history (reference only): countries approved sellers have exported to, with approved buyers from each.
  const markets = new Map<string, number>();
  for (const x of sellers) for (const c of parseCerts(x.exportCountries)) markets.set(c, (markets.get(c) ?? 0) + 1);
  const exportMarkets = [...markets.entries()].map(([country, n]) => ({ country, sellers: n, buyers: buyerCountries.find((b) => b.country === country)?._count ?? 0 }))
    .sort((a, b) => b.sellers - a.sellers || a.country.localeCompare(b.country));
  const exporters = count(sellers, (s) => parseCerts(s.exportCountries).length > 0);

  return { summary: { ...summary, exporters }, dims, byDistrict, certReadiness, exportMarkets };
}
export type SellerProfileStats = Awaited<ReturnType<typeof sellerProfileStats>>;
