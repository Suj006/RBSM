import type { Prisma } from "@/generated/prisma/client";
import type { BuyerStatus, ItemStatus, Role } from "@/generated/prisma/enums";
import { ALL_ITEM_STATUSES, ALL_STATUSES, DIC_ITEM_QUEUE, DIC_VISIBLE_ITEMS, FIEO_ITEM_QUEUE } from "@/lib/status";

export type BuyerFilters = { q?: string; status?: string; item?: string; country?: string; sector?: string; page?: string };

/** Sector rows a role may see (the Directorate sees only what FIEO recommended onwards). */
export function itemScope(role: Role): Prisma.RequirementItemWhereInput {
  return role === "DIC" ? { status: { in: DIC_VISIBLE_ITEMS } } : {};
}

/** Which buyers a staff role may see at all. */
export function scopeFor(role: Role): Prisma.BuyerWhereInput {
  return role === "DIC" ? { requirement: { items: { some: itemScope("DIC") } } } : {};
}

/** Buyers waiting for this role's decision (basic details or any sector). */
export function actionWhere(role: Role): Prisma.BuyerWhereInput {
  if (role === "DIC") return { requirement: { items: { some: { status: { in: DIC_ITEM_QUEUE } } } } };
  return {
    OR: [
      { status: "BASIC_SUBMITTED" },
      { requirement: { items: { some: { status: { in: FIEO_ITEM_QUEUE } } } } },
    ],
  };
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
  if (f.status === "action") and.push(actionWhere(role));
  else if (f.status && ALL_STATUSES.includes(f.status as BuyerStatus)) and.push({ status: f.status as BuyerStatus });

  const item: Prisma.RequirementItemWhereInput = { ...itemScope(role) };
  let filterItems = false;
  if (f.item && ALL_ITEM_STATUSES.includes(f.item as ItemStatus)) {
    item.status = f.item as ItemStatus;
    filterItems = true;
  }
  if (f.sector) {
    item.sectorId = f.sector;
    filterItems = true;
  }
  if (filterItems) and.push({ requirement: { items: { some: item } } });
  if (f.country) and.push({ country: f.country });
  return { AND: and };
}

export const PAGE_SIZE = 25;
