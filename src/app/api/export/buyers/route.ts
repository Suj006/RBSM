import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buyerWhere, itemScope } from "@/lib/buyer-query";
import { csvResponse, stamp } from "@/lib/csv";
import { ITEM_META, STATUS_META } from "@/lib/status";
import { parseCerts } from "@/lib/format";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role === "BUYER") return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const rows = await prisma.buyer.findMany({
    where: buyerWhere(user.role, sp),
    orderBy: [{ approvedSeq: "asc" }, { seq: "asc" }],
    include: {
      user: { select: { username: true } },
      documents: { select: { kind: true } },
      requirement: { include: { items: { where: itemScope(user.role), orderBy: { sortOrder: "asc" }, include: { sector: true } } } },
    },
  });
  return csvResponse(
    `rbsm-buyers-${stamp()}.csv`,
    ["Reg. No.", "Buyer No.", "Login ID", "Buyer name", "Country", "Sign-up e-mail", "Contact name", "Designation", "Contact e-mail",
      "Mobile", "Status", "Profile uploaded", "Credentials uploaded", "Organisation type", "Annual sourcing value", "Sourcing timeline",
      "Preferred engagement", "Sectors (status)", "Approved sectors", "Pending sectors", "Products", "Certifications", "Procurement interests",
      "Registered on", "Basic submitted", "Basic approved", "Approved as buyer"],
    rows.map((b) => {
      const items = b.requirement?.items ?? [];
      return [
        b.regNo, b.approvedNo, b.user.username, b.name, b.country, b.signupEmail, b.pocName, b.pocDesignation, b.pocEmail,
        b.pocMobile, STATUS_META[b.status].label,
        b.documents.some((d) => d.kind === "PROFILE") ? "Yes" : "No",
        b.documents.some((d) => d.kind === "CREDENTIALS") ? "Yes" : "No",
        b.requirement?.organisationType, b.requirement?.annualSourcingValue, b.requirement?.sourcingTimeline,
        b.requirement?.preferredEngagement,
        items.map((i) => `${i.sector.name} (${ITEM_META[i.status].short})`).join("; "),
        items.filter((i) => i.status === "APPROVED").map((i) => i.sector.name).join("; "),
        items.filter((i) => i.status !== "APPROVED").map((i) => i.sector.name).join("; "),
        items.map((i) => `${i.sector.name}: ${i.products}`).join(" | "),
        [...new Set(items.flatMap((i) => parseCerts(i.certifications)))].join("; "),
        b.requirement?.procurementInterests,
        b.createdAt, b.basicSubmittedAt, b.basicApprovedAt, b.approvedAt,
      ];
    }),
  );
}
