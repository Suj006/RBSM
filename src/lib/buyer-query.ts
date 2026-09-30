import type { Prisma } from "@/generated/prisma/client";
import type { BuyerStatus, Role } from "@/generated/prisma/enums";
import { ALL_STATUSES, DIC_VISIBLE, FIEO_ACTIONABLE } from "@/lib/status";

export type BuyerFilters = { q?: string; status?: string; country?: string; sector?: string; page?: string };

/** Which buyers a staff role may see at all. */
export function scopeFor(role: Role): Prisma.BuyerWhereInput {
  return role === "DIC" ? { status: { in: DIC_VISIBLE } } : {};
}

export function buyerWhere(role: Role, f: BuyerFilters): Prisma.BuyerWhereInput {
  const and: Prisma.BuyerWhereInput[] = [scopeFor(role)];
  const q = f.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q } },
        { regNo: { contains: q } },
        { approvedNo: { contains: q } },
        { signupEmail: { contains: q } },
        { pocName: { contains: q } },
        { pocEmail: { contains: q } },
        { user: { username: { contains: q } } },
      ],
    });
  }
  if (f.status === "action") {
    and.push({ status: { in: role === "DIC" ? ["FIEO_RECOMMENDED"] : FIEO_ACTIONABLE } });
  } else if (f.status && ALL_STATUSES.includes(f.status as BuyerStatus)) {
    and.push({ status: f.status as BuyerStatus });
  }
  if (f.country) and.push({ country: f.country });
  if (f.sector) and.push({ requirement: { items: { some: { sectorId: f.sector } } } });
  return { AND: and };
}

export const PAGE_SIZE = 25;
