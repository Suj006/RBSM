import "server-only";
import { prisma } from "@/lib/prisma";
import { DISTRICTS } from "@/lib/config";
import { getTargets } from "@/lib/targets";

/** Live programme figures for the public front page (counts only, no personal data). */
export async function landingStats() {
  const [buyers, countries, approvedBuyers, sellers, approvedSellers, byDistrict, sectors, sellerSectors, demand, targets] = await Promise.all([
    prisma.buyer.count(),
    prisma.buyer.findMany({ distinct: ["country"], select: { country: true } }),
    prisma.buyer.count({ where: { status: "APPROVED" } }),
    prisma.seller.count({ where: { status: { not: "REJECTED" } } }),
    prisma.seller.count({ where: { status: "APPROVED" } }),
    prisma.seller.groupBy({ by: ["district"], where: { status: "APPROVED" }, _count: true }),
    prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.sellerProduct.groupBy({ by: ["sectorId"], where: { seller: { status: "APPROVED" } }, _count: true }),
    prisma.requirementItem.groupBy({ by: ["sectorId"], where: { status: { not: "DRAFT" } }, _count: true }),
    getTargets(),
  ]);
  return {
    buyers, countries: countries.length, approvedBuyers, sellers, approvedSellers,
    targets: { sellers: targets.sellers, buyers: targets.buyers, sellersPerBuyer: targets.sellersPerBuyer },
    districts: DISTRICTS.map((d) => ({ name: d.name, sellers: byDistrict.find((x) => x.district === d.name)?._count ?? 0 })),
    sectors: sectors.map((s) => ({
      ...s,
      sellers: sellerSectors.find((x) => x.sectorId === s.id)?._count ?? 0,
      requirements: demand.find((x) => x.sectorId === s.id)?._count ?? 0,
    })),
  };
}
