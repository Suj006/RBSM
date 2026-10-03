import type { Prisma, User } from "@/generated/prisma/client";
import type { SellerStatus } from "@/generated/prisma/enums";
import { ALL_SELLER_STATUSES, SELLER_PENDING, SELLER_VISIBLE } from "@/lib/status";

export type SellerFilters = { q?: string; status?: string; sector?: string; district?: string; exp?: string; source?: string; page?: string };

/** Sellers a user may see at all. Districts see their own district; FIEO only approved sellers; the Directorate and Admin all. */
export function sellerScope(user: Pick<User, "role" | "district">): Prisma.SellerWhereInput {
  if (user.role === "DISTRICT") return { district: user.district ?? "__none__" };
  const visible = SELLER_VISIBLE[user.role];
  if (visible) return { status: { in: visible } };
  if (user.role === "ADMIN" || user.role === "DIC") return {};
  return { id: "__none__" };
}

export function sellerWhere(user: Pick<User, "role" | "district">, f: SellerFilters): Prisma.SellerWhereInput {
  const and: Prisma.SellerWhereInput[] = [sellerScope(user)];
  const q = f.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q } }, { regNo: { contains: q } }, { approvedNo: { contains: q } },
        { udyamNo: { contains: q.toUpperCase() } }, { contactName: { contains: q } }, { contactEmail: { contains: q.toLowerCase() } },
        { contactMobile: { contains: q.replace(/\D/g, "") || q } }, { taluk: { contains: q } }, { localBodyName: { contains: q } },
      ],
    });
  }
  if (f.status === "action") {
    and.push({ status: { in: user.role === "DISTRICT" ? ["WITH_DISTRICT", "RETURNED"] : ["RECOMMENDED"] } });
  } else if (f.status === "pending") {
    and.push({ status: { in: SELLER_PENDING } });
  } else if (f.status && ALL_SELLER_STATUSES.includes(f.status as SellerStatus)) {
    and.push({ status: f.status as SellerStatus });
  }
  if (f.sector) and.push({ products: { some: { sectorId: f.sector } } });
  if (f.district) and.push({ district: f.district });
  if (f.exp === "yes") and.push({ exportExperience: true });
  if (f.exp === "no") and.push({ exportExperience: false });
  if (f.source === "SELF" || f.source === "DISTRICT" || f.source === "BULK") and.push({ source: f.source });
  return { AND: and };
}
