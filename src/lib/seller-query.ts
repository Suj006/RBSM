import type { Prisma, User } from "@/generated/prisma/client";
import type { SellerStatus } from "@/generated/prisma/enums";
import { ALL_SELLER_STATUSES, SELLER_PENDING, SELLER_VISIBLE } from "@/lib/status";
import { optLabel, UNIT_CATEGORIES, UNIT_TYPES } from "@/lib/config";

/** Plain-language labels of the profile filters (for report headers). */
export function describeProfileFilters(f: SellerFilters): string[] {
  const out: string[] = [];
  if (f.profile === "done") out.push("Profile: completed");
  if (f.profile === "pending") out.push("Profile: pending with seller");
  if (f.cat) out.push(`Category: ${optLabel(UNIT_CATEGORIES, f.cat)}`);
  if (f.utype) out.push(`Unit type: ${optLabel(UNIT_TYPES, f.utype)}`);
  if (f.promoter === "women") out.push("Women promoters");
  if (f.promoter === "scst") out.push("SC / ST promoters");
  if (f.promoter === "disabled") out.push("Specially abled promoters");
  if (f.iec === "yes") out.push("IEC number: given");
  if (f.iec === "no") out.push("IEC number: not given");
  if (f.cert === "yes") out.push("Holds certifications");
  if (f.cert === "no") out.push("No certifications");
  return out;
}

export type SellerFilters = {
  q?: string; status?: string; sector?: string; district?: string; exp?: string; source?: string; page?: string;
  /** Profile completed by the approved seller: done / pending. */
  profile?: string;
  /** Unit category (MICRO…) and unit type (MANUFACTURING…). */
  cat?: string; utype?: string;
  /** Promoter: women / scst / disabled. */
  promoter?: string;
  /** IEC number given / certifications held: yes / no. */
  iec?: string; cert?: string;
};

/** The filter keys that narrow sellers (everything except paging). */
export const SELLER_FILTER_KEYS = ["q", "status", "sector", "district", "exp", "source", "profile", "cat", "utype", "promoter", "iec", "cert"] as const;

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
        { iecNo: { contains: q.toUpperCase() } }, { block: { contains: q } },
        { exportCountries: { contains: q } }, { exportedProducts: { contains: q } },
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
  if (f.profile === "done") and.push({ profileCompletedAt: { not: null } });
  if (f.profile === "pending") and.push({ status: "APPROVED", profileCompletedAt: null });
  if (f.cat && UNIT_CATEGORIES.some((o) => o.value === f.cat)) and.push({ unitCategory: f.cat });
  if (f.utype && UNIT_TYPES.some((o) => o.value === f.utype)) and.push({ unitType: f.utype });
  const personal = user.role !== "FIEO";
  if (personal && f.promoter === "women") and.push({ promoterGender: "FEMALE" });
  if (personal && f.promoter === "scst") and.push({ socialCategory: { in: ["SC", "ST"] } });
  if (personal && f.promoter === "disabled") and.push({ speciallyAbled: true });
  if (f.iec === "yes") and.push({ iecNo: { not: null } });
  if (f.iec === "no") and.push({ iecNo: null });
  if (f.cert === "yes") and.push({ certifications: { not: "[]" } });
  if (f.cert === "no") and.push({ certifications: "[]" });
  return { AND: and };
}
