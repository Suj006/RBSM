import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { itemScope, scopeFor } from "@/lib/buyer-query";
import { Alert, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { JourneyStepper } from "@/components/journey";
import { Timeline } from "@/components/timeline";
import { DocLink } from "@/components/doc-link";
import { SourcingProfileView } from "@/components/requirement-view";
import { PrintButton } from "@/components/print-button";
import { ReviewPanel } from "./review-panel";
import { ItemReview } from "./item-review";
import { fmtDateTime, parseCerts } from "@/lib/format";

export async function BuyerDetailPage({ role, id, base, extra }: { role: Role; id: string; base: string; extra?: (buyerId: string) => React.ReactNode }) {
  const b = await prisma.buyer.findFirst({
    where: { AND: [{ id }, scopeFor(role)] },
    include: {
      user: { select: { username: true, lastLoginAt: true } },
      documents: true,
      requirement: {
        include: {
          items: {
            where: itemScope(role),
            orderBy: { sortOrder: "asc" },
            include: { sector: true, reviewLogs: { orderBy: { createdAt: "desc" } } },
          },
        },
      },
      reviewLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { displayName: true } } } },
    },
  });
  if (!b) notFound();
  const doc = (k: "PROFILE" | "CREDENTIALS") => b.documents.find((d) => d.kind === k) ?? null;
  const basicPending = role === "FIEO" && b.status === "BASIC_SUBMITTED";

  return (
    <>
      <Link href={base} className="no-print mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Back to list
      </Link>
      <PageHeader
        eyebrow={<>{b.regNo}{b.approvedNo && <> · <span className="text-brand-700">{b.approvedNo}</span></>}</>}
        title={b.name}
        subtitle={`${b.country} · Login ${b.user.username}`}
        actions={<><StatusBadge status={b.status} /><PrintButton /></>}
      />
      <Card className="mb-6 p-5 sm:p-6"><JourneyStepper status={b.status} /></Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Basic details" subtitle={b.basicSubmittedAt ? `Submitted ${fmtDateTime(b.basicSubmittedAt)}` : "Not yet submitted"} />
            <div className="space-y-6 p-6">
              <DL cols={3} items={[
                { label: "Name of the buyer", value: b.name },
                { label: "Country", value: b.country },
                { label: "Sign-up e-mail", value: b.signupEmail },
                { label: "Contact person", value: b.pocName },
                { label: "Designation", value: b.pocDesignation },
                { label: "Contact e-mail", value: b.pocEmail },
                { label: "Mobile number", value: b.pocMobile },
                { label: "Registered on", value: fmtDateTime(b.createdAt) },
                { label: "Last login", value: fmtDateTime(b.user.lastLoginAt) },
              ]} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Company profile</div><DocLink doc={doc("PROFILE")} /></div>
                <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Organisation credentials</div><DocLink doc={doc("CREDENTIALS")} /></div>
              </div>
            </div>
          </Card>
          {b.requirement ? <SourcingProfileView req={b.requirement} /> : <Alert tone="slate">The buyer has not started the detailed requirement yet.</Alert>}
        </div>

        <div className="space-y-6">
          {role === "FIEO" && (b.status === "BASIC_SUBMITTED" || b.status === "BASIC_RETURNED" || b.status === "SIGNED_UP") && (
            // Stays mounted so the confirmation remains visible after the status moves on.
            <Card className={basicPending ? "no-print border-brand-200 p-5 ring-2 ring-brand-100" : "no-print p-5"}>
              <ReviewPanel
                buyerId={b.id}
                heading={basicPending ? "Verify basic details" : "Basic details"}
                note={basicPending
                  ? "Check the buyer's identity, contact and documents. Approving lets the buyer add sector requirements."
                  : "Waiting for the buyer to submit their basic details."}
                actions={basicPending ? [
                  { decision: "approve_basic", label: "Approve basic details", variant: "success", needsComment: false },
                  { decision: "return_basic", label: "Return to buyer for correction", variant: "danger", needsComment: true },
                ] : []}
              />
            </Card>
          )}
          {extra?.(b.id)}
          <Card>
            <CardHeader title="Activity & comments" />
            <div className="max-h-[560px] overflow-y-auto p-5"><Timeline logs={b.reviewLogs} /></div>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <ItemReview
          buyerId={b.id}
          role={role}
          items={(b.requirement?.items ?? []).map((i) => ({
            id: i.id, sectorName: i.sector.name, status: i.status, everApproved: i.everApproved,
            products: i.products, specifications: i.specifications, certifications: parseCerts(i.certifications), quantity: i.quantity,
            history: i.reviewLogs.map((l) => ({ id: l.id, action: l.action, actorRole: l.actorRole, comment: l.comment, at: fmtDateTime(l.createdAt) })),
          }))}
        />
      </div>
    </>
  );
}
