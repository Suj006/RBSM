import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buyerWhere } from "@/lib/buyer-query";
import { csvResponse, stamp } from "@/lib/csv";
import { STATUS_META } from "@/lib/status";
import { parseCerts } from "@/lib/format";

// One row per buyer × sector — the working sheet for matchmaking.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role === "BUYER") return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const items = await prisma.requirementItem.findMany({
    where: {
      requirement: { buyer: buyerWhere(user.role, sp) },
      ...(sp.sector ? { sectorId: sp.sector } : {}),
    },
    orderBy: [{ sector: { name: "asc" } }, { requirement: { buyer: { seq: "asc" } } }],
    include: { sector: true, requirement: { include: { buyer: true } } },
  });
  return csvResponse(
    `rbsm-sector-requirements-${stamp()}.csv`,
    ["Sector", "Products", "Specifications", "Certifications", "Indicative quantity", "Reg. No.", "Buyer No.", "Buyer name",
      "Country", "Organisation type", "Annual sourcing value", "Sourcing timeline", "Contact name", "Contact e-mail", "Mobile", "Status"],
    items.map((i) => {
      const b = i.requirement.buyer;
      return [
        i.sector.name, i.products, i.specifications, parseCerts(i.certifications).join("; "), i.quantity,
        b.regNo, b.approvedNo, b.name, b.country, i.requirement.organisationType, i.requirement.annualSourcingValue,
        i.requirement.sourcingTimeline, b.pocName, b.pocEmail, b.pocMobile, STATUS_META[b.status].label,
      ];
    }),
  );
}
