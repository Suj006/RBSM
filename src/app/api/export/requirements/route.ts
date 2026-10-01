import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buyerWhere, itemScope } from "@/lib/buyer-query";
import { csvResponse, stamp } from "@/lib/csv";
import { ALL_ITEM_STATUSES, ITEM_META, STATUS_META } from "@/lib/status";
import type { ItemStatus } from "@/generated/prisma/enums";
import { parseCerts } from "@/lib/format";

// One row per buyer × sector — the working sheet for matchmaking.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role === "BUYER") return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const items = await prisma.requirementItem.findMany({
    where: {
      ...itemScope(user.role),
      requirement: { buyer: buyerWhere(user.role, sp) },
      ...(sp.sector ? { sectorId: sp.sector } : {}),
      ...(sp.item && ALL_ITEM_STATUSES.includes(sp.item as ItemStatus) ? { status: sp.item as ItemStatus } : {}),
    },
    orderBy: [{ sector: { name: "asc" } }, { requirement: { buyer: { seq: "asc" } } }],
    include: { sector: true, requirement: { include: { buyer: true } } },
  });
  return csvResponse(
    `rbsm-sector-requirements-${stamp()}.csv`,
    ["Sector", "Sector status", "Products", "Specifications", "Certifications", "Indicative quantity", "Submitted", "Recommended",
      "Approved", "Reg. No.", "Buyer No.", "Buyer name", "Country", "Organisation type", "Annual sourcing value", "Sourcing timeline",
      "Contact name", "Contact e-mail", "Mobile", "Buyer status"],
    items.map((i) => {
      const b = i.requirement.buyer;
      return [
        i.sector.name, ITEM_META[i.status].label, i.products, i.specifications, parseCerts(i.certifications).join("; "), i.quantity,
        i.submittedAt, i.recommendedAt, i.approvedAt, b.regNo, b.approvedNo, b.name, b.country, i.requirement.organisationType, i.requirement.annualSourcingValue,
        i.requirement.sourcingTimeline, b.pocName, b.pocEmail, b.pocMobile, STATUS_META[b.status].label,
      ];
    }),
  );
}
