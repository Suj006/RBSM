import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { ProfileForm } from "@/components/buyer/profile-form";
import { RequirementBoard } from "@/components/buyer/requirement-board";
import { StatusBadge } from "@/components/status-badge";
import { canWorkOnRequirements, ROLE_LABEL } from "@/lib/status";
import { parseCerts } from "@/lib/format";

export const metadata: Metadata = { title: "Detailed requirement" };

export default async function RequirementPage() {
  const { buyer: b } = await requireBuyer();
  const header = (
    <PageHeader back={{ href: "/buyer", label: "Back to dashboard" }} eyebrow={b.regNo} title="Detailed requirement"
      subtitle="Your sourcing requirement by sector — the basis for buyer–seller matchmaking. Each sector is approved separately."
      actions={<StatusBadge status={b.status} />} />
  );

  if (!canWorkOnRequirements(b.status)) {
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

  const [req, sectors, certs] = await Promise.all([
    prisma.requirement.findUnique({
      where: { buyerId: b.id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            sector: true,
            // Latest comment addressed to the buyer (FIEO returns only).
            reviewLogs: { where: { action: "REQ_RETURNED" }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    }),
    prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.certification.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  // Keep sectors the buyer already chose even if the admin has since deactivated them.
  for (const it of req?.items ?? []) {
    if (!sectors.some((s) => s.id === it.sectorId)) sectors.push({ id: it.sector.id, name: `${it.sector.name} (inactive)` });
  }
  const profile = {
    organisationType: req?.organisationType ?? "",
    procurementInterests: req?.procurementInterests ?? "",
    annualSourcingValue: req?.annualSourcingValue ?? "",
    sourcingTimeline: req?.sourcingTimeline ?? "",
    preferredEngagement: req?.preferredEngagement ?? "",
  };
  const profileComplete = Boolean(profile.organisationType && profile.procurementInterests.length >= 20 && profile.annualSourcingValue && profile.sourcingTimeline);

  return (
    <>
      {header}
      <div className="space-y-8">
        <ProfileForm profile={profile} complete={profileComplete} />
        <RequirementBoard
          profileComplete={profileComplete}
          sectors={sectors}
          certifications={certs.map((c) => c.name)}
          items={(req?.items ?? []).map((i) => ({
            id: i.id, sectorId: i.sectorId, sectorName: i.sector.name, status: i.status, everApproved: i.everApproved,
            products: i.products, specifications: i.specifications ?? "", certifications: parseCerts(i.certifications), quantity: i.quantity ?? "",
            lastComment: i.reviewLogs[0]?.comment ? { text: i.reviewLogs[0].comment, by: ROLE_LABEL[i.reviewLogs[0].actorRole] } : null,
          }))}
        />
      </div>
    </>
  );
}
