import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { scopeFor } from "@/lib/buyer-query";
import { Alert, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { JourneyStepper } from "@/components/journey";
import { Timeline } from "@/components/timeline";
import { DocLink } from "@/components/doc-link";
import { RequirementView } from "@/components/requirement-view";
import { PrintButton } from "@/components/print-button";
import { ReviewPanel, type PanelAction } from "./review-panel";
import { fmtDateTime } from "@/lib/format";

function panelFor(role: Role, status: string): { heading: string; note?: string; actions: PanelAction[] } | null {
  if (role === "FIEO" && status === "BASIC_SUBMITTED") {
    return {
      heading: "Verify basic details",
      note: "Check the buyer's identity, contact and documents. Approving lets the buyer fill the detailed requirement.",
      actions: [
        { decision: "approve_basic", label: "Approve basic details", variant: "success", needsComment: false },
        { decision: "return_basic", label: "Return to buyer for correction", variant: "danger", needsComment: true },
      ],
    };
  }
  if (role === "FIEO" && (status === "REQ_SUBMITTED" || status === "DIC_RETURNED")) {
    return {
      heading: status === "DIC_RETURNED" ? "Re-verify and recommend again" : "Recommend to Directorate",
      note: status === "DIC_RETURNED" ? "The Directorate returned this application — see the comment in the activity log." : "Review the detailed requirement before recommending.",
      actions: [
        { decision: "recommend", label: "Recommend to Directorate", variant: "primary", needsComment: false },
        { decision: "return_requirement", label: "Return to buyer for correction", variant: "danger", needsComment: true },
      ],
    };
  }
  if (role === "DIC" && status === "FIEO_RECOMMENDED") {
    return {
      heading: "Directorate decision",
      note: "Approving adds the buyer to the RBSM buyer list and generates the buyer number.",
      actions: [
        { decision: "dic_approve", label: "Approve & add to RBSM buyer list", variant: "success", needsComment: false, confirm: "Approve this buyer and generate the RBSM buyer number?" },
        { decision: "dic_return", label: "Return to FIEO for re-verification", variant: "danger", needsComment: true },
      ],
    };
  }
  return null;
}

export async function BuyerDetailPage({ role, id, base, extra }: { role: Role; id: string; base: string; extra?: (buyerId: string) => React.ReactNode }) {
  const b = await prisma.buyer.findFirst({
    where: { AND: [{ id }, scopeFor(role)] },
    include: {
      user: { select: { username: true, lastLoginAt: true } },
      documents: true,
      requirement: { include: { items: { orderBy: { sortOrder: "asc" }, include: { sector: true } } } },
      reviewLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { displayName: true } } } },
    },
  });
  if (!b) notFound();
  const doc = (k: "PROFILE" | "CREDENTIALS") => b.documents.find((d) => d.kind === k) ?? null;
  const panel = panelFor(role, b.status);

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

          {b.requirement ? (
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink">Detailed requirement</h2>
              <RequirementView req={b.requirement} />
            </div>
          ) : (
            <Alert tone="slate">The buyer has not started the detailed requirement yet.</Alert>
          )}
        </div>

        <div className="space-y-6">
          {(role === "FIEO" || role === "DIC") && (
            // Always mounted so the confirmation stays visible after the status moves on.
            <Card className={panel ? "no-print border-brand-200 p-5 ring-2 ring-brand-100" : "no-print p-5"}>
              <ReviewPanel buyerId={b.id} {...(panel ?? { heading: "No action pending", note: "This application is not at a stage that needs your decision.", actions: [] })} />
            </Card>
          )}
          {extra?.(b.id)}
          <Card>
            <CardHeader title="Activity & comments" />
            <div className="p-5"><Timeline logs={b.reviewLogs} /></div>
          </Card>
        </div>
      </div>
    </>
  );
}
