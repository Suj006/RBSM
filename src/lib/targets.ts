import "server-only";
import { prisma } from "@/lib/prisma";
import { DISTRICT_NAMES, EVENT } from "@/lib/config";

export type Targets = {
  sellers: number;
  buyers: number;
  sellersPerBuyer: number;
  /** Approved-seller target per district (explicit, or the even share of the overall target). */
  district: Record<string, number>;
  /** Districts whose target was set explicitly by the Directorate. */
  districtSet: Record<string, boolean>;
  updatedAt: Date | null;
  updatedBy: string | null;
};

/** Even split of the overall target across districts (largest remainders first, so it adds up exactly). */
export function evenShares(total: number) {
  const n = DISTRICT_NAMES.length;
  const base = Math.floor(total / n);
  let extra = total - base * n;
  return Object.fromEntries(DISTRICT_NAMES.map((d) => [d, base + (extra-- > 0 ? 1 : 0)]));
}

export async function getTargets(): Promise<Targets> {
  const rows = await prisma.target.findMany({ include: { updatedBy: { select: { displayName: true } } } });
  const get = (k: string, fallback: number) => rows.find((r) => r.key === k)?.value ?? fallback;
  const sellers = get("sellers", EVENT.targetSellers);
  const even = evenShares(sellers);
  const district: Record<string, number> = {};
  const districtSet: Record<string, boolean> = {};
  for (const d of DISTRICT_NAMES) {
    const r = rows.find((x) => x.key === `district:${d}`);
    district[d] = r?.value ?? even[d];
    districtSet[d] = Boolean(r);
  }
  const latest = rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  return {
    sellers,
    buyers: get("buyers", EVENT.targetBuyers),
    sellersPerBuyer: get("sellersPerBuyer", 10),
    district,
    districtSet,
    updatedAt: latest?.updatedAt ?? null,
    updatedBy: latest?.updatedBy?.displayName ?? null,
  };
}
