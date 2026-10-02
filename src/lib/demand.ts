import "server-only";
import type { User } from "@/generated/prisma/client";
import type { ItemStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { itemScope } from "@/lib/buyer-query";
import { parseCerts } from "@/lib/format";

// Sector-wise view of buyer demand (what buyers want, product by product) and
// seller supply (approved sellers offering the sector) — the basis for matchmaking.

const splitProducts = (s: string) => s.split(/[,\n;]/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.length > 1);
const key = (p: string) => p.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().replace(/(?<=[a-z]{3})s$/, "");

/** Buyer requirement rows counted as demand: everything submitted (drafts excluded), within the role's scope. */
function demandWhere(user: User) {
  const scope = itemScope(user.role);
  return { ...scope, status: scope.status ?? { not: "DRAFT" as ItemStatus } };
}

export type ProductCount = { product: string; buyers: number; buyerNames: string[]; sellers: number };

function tally(rows: { products: string; who: string }[]) {
  const m = new Map<string, { product: string; who: Set<string> }>();
  for (const r of rows) for (const p of splitProducts(r.products)) {
    const k = key(p);
    if (!k) continue;
    const e = m.get(k) ?? { product: p, who: new Set<string>() };
    e.who.add(r.who);
    m.set(k, e);
  }
  return m;
}

export async function sectorDemandSummary(user: User) {
  const [sectors, items, sellerProducts] = await Promise.all([
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.requirementItem.findMany({
      where: demandWhere(user),
      select: { sectorId: true, status: true, products: true, requirement: { select: { buyerId: true, buyer: { select: { name: true } } } } },
    }),
    prisma.sellerProduct.findMany({ where: { seller: { status: "APPROVED" } }, select: { sectorId: true, products: true, sellerId: true, seller: { select: { name: true } } } }),
  ]);
  return sectors
    .map((s) => {
      const its = items.filter((i) => i.sectorId === s.id);
      const sps = sellerProducts.filter((p) => p.sectorId === s.id);
      const demand = tally(its.map((i) => ({ products: i.products, who: i.requirement.buyer.name })));
      const supply = tally(sps.map((p) => ({ products: p.products, who: p.seller.name })));
      const top: ProductCount[] = [...demand.entries()]
        .map(([k, v]) => ({ product: v.product, buyers: v.who.size, buyerNames: [...v.who], sellers: supply.get(k)?.who.size ?? 0 }))
        .sort((a, b) => b.buyers - a.buyers || a.product.localeCompare(b.product));
      const buyers = new Set(its.map((i) => i.requirement.buyerId)).size;
      return {
        id: s.id, name: s.name, buyers,
        approvedReqs: its.filter((i) => i.status === "APPROVED").length,
        pendingReqs: its.filter((i) => i.status !== "APPROVED").length,
        sellers: new Set(sps.map((p) => p.sellerId)).size,
        products: top,
        matchedProducts: top.filter((p) => p.sellers > 0).length,
      };
    })
    .filter((s) => s.buyers > 0 || s.sellers > 0);
}

export async function sectorDemandDetail(user: User, sectorId: string) {
  const sector = await prisma.sector.findUnique({ where: { id: sectorId } });
  if (!sector) return null;
  const [items, sellers] = await Promise.all([
    prisma.requirementItem.findMany({
      where: { ...demandWhere(user), sectorId },
      orderBy: { requirement: { buyer: { seq: "asc" } } },
      include: { requirement: { include: { buyer: { select: { id: true, name: true, regNo: true, approvedNo: true, country: true } } } } },
    }),
    prisma.seller.findMany({
      where: { status: "APPROVED", products: { some: { sectorId } } },
      orderBy: { approvedSeq: "asc" },
      include: { products: { where: { sectorId } } },
    }),
  ]);
  const demand = tally(items.map((i) => ({ products: i.products, who: i.requirement.buyer.name })));
  const supply = tally(sellers.map((s) => ({ products: s.products[0]?.products ?? "", who: s.name })));
  const products: ProductCount[] = [...demand.entries()]
    .map(([k, v]) => ({ product: v.product, buyers: v.who.size, buyerNames: [...v.who], sellers: supply.get(k)?.who.size ?? 0 }))
    .sort((a, b) => b.buyers - a.buyers || a.product.localeCompare(b.product));
  const certs = new Map<string, number>();
  for (const i of items) for (const c of parseCerts(i.certifications)) certs.set(c, (certs.get(c) ?? 0) + 1);
  return {
    sector,
    buyers: items.map((i) => ({
      itemId: i.id, buyerId: i.requirement.buyer.id, name: i.requirement.buyer.name, regNo: i.requirement.buyer.regNo,
      approvedNo: i.requirement.buyer.approvedNo, country: i.requirement.buyer.country, status: i.status,
      products: i.products, specifications: i.specifications, certifications: parseCerts(i.certifications), quantity: i.quantity,
      sourcingValue: i.requirement.annualSourcingValue,
    })),
    sellers: sellers.map((s) => ({
      id: s.id, name: s.name, approvedNo: s.approvedNo, district: s.district, exportExperience: s.exportExperience,
      products: s.products[0]?.products ?? "",
      // Products this seller offers that buyers in this sector asked for.
      matches: splitProducts(s.products[0]?.products ?? "").filter((p) => demand.has(key(p))),
    })),
    products,
    certifications: [...certs.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })),
  };
}
