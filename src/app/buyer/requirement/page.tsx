import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { Alert, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { RequirementForm } from "@/components/buyer/requirement-form";
import { RequirementView } from "@/components/requirement-view";
import { StatusBadge } from "@/components/status-badge";
import { canEditRequirement } from "@/lib/status";
import { parseCerts } from "@/lib/format";

export const metadata: Metadata = { title: "Detailed requirement" };

export default async function RequirementPage() {
  const { buyer: b } = await requireBuyer();
  const header = <PageHeader eyebrow={b.regNo} title="Detailed requirement" subtitle="Your sourcing requirement, by sector — the basis for buyer–seller matchmaking." actions={<StatusBadge status={b.status} />} />;

  if (b.status === "SIGNED_UP" || b.status === "BASIC_SUBMITTED" || b.status === "BASIC_RETURNED") {
    return (
      <>
        {header}
        <Card>
          <EmptyState icon={<Lock className="size-5" />} title="Available after FIEO approves your basic details">
            {b.status === "BASIC_SUBMITTED" ? "Your basic details are under review. You'll be notified by e-mail." : "Complete and submit your basic details first."}
            {b.status !== "BASIC_SUBMITTED" && <div className="mt-4"><ButtonLink href="/buyer/profile">Go to basic details</ButtonLink></div>}
          </EmptyState>
        </Card>
      </>
    );
  }

  const req = await prisma.requirement.findUnique({
    where: { buyerId: b.id },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { sector: true } } },
  });

  if (!canEditRequirement(b.status)) {
    return (
      <>
        {header}
        <Alert tone={b.status === "APPROVED" ? "green" : "amber"} className="mb-6">
          {b.status === "APPROVED"
            ? "Your registration has been approved by the Directorate."
            : "Your requirement has been submitted to FIEO for recommendation and is locked while it is under review."}
        </Alert>
        {req && <RequirementView req={req} />}
      </>
    );
  }

  const [sectors, certs, lastReturn] = await Promise.all([
    prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.certification.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
    b.status === "REQ_RETURNED"
      ? prisma.reviewLog.findFirst({ where: { buyerId: b.id, action: "REQ_RETURNED" }, orderBy: { createdAt: "desc" } })
      : null,
  ]);
  // Keep sectors the buyer already chose even if the admin has since deactivated them.
  for (const it of req?.items ?? []) {
    if (!sectors.some((s) => s.id === it.sectorId)) sectors.push({ id: it.sector.id, name: `${it.sector.name} (inactive)` });
  }

  return (
    <>
      {header}
      {lastReturn?.comment && <Alert tone="red" className="mb-6" title="Returned by FIEO">{lastReturn.comment}</Alert>}
      <RequirementForm
        header={{
          organisationType: req?.organisationType ?? "",
          procurementInterests: req?.procurementInterests ?? "",
          annualSourcingValue: req?.annualSourcingValue ?? "",
          sourcingTimeline: req?.sourcingTimeline ?? "",
          preferredEngagement: req?.preferredEngagement ?? "",
        }}
        items={(req?.items ?? []).map((i) => ({
          sectorId: i.sectorId, products: i.products, specifications: i.specifications ?? "",
          certifications: parseCerts(i.certifications), quantity: i.quantity ?? "",
        }))}
        sectors={sectors}
        certifications={certs.map((c) => c.name)}
      />
    </>
  );
}
