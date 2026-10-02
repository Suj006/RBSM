import { notFound } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { actionWhere, itemScope, scopeFor } from "@/lib/buyer-query";
import { backFor } from "@/components/nav/back-target";
import { Alert, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { DIC_ITEM_QUEUE, FIEO_ITEM_QUEUE } from "@/lib/status";
import { JourneyStepper } from "@/components/journey";
import { Timeline } from "@/components/timeline";
import { DocLink } from "@/components/doc-link";
import { SourcingProfileView } from "@/components/requirement-view";
import { DownloadButtons } from "./download-buttons";
import { ReviewPanel } from "./review-panel";
import { ItemReview } from "./item-review";
import { fmtDateTime, parseCerts } from "@/lib/format";
import { parseSnapshot, type ItemSnapshot, type ProfileSnapshot } from "@/lib/item-snapshot";

/** Approved sectors being modified compare with the approved version; returned ones with what FIEO returned. */
function baselineFor(i: { status: string; approvedSnapshot: string | null; returnedSnapshot: string | null }) {
  if (i.status === "APPROVED") return null;
  const approved = parseSnapshot<ItemSnapshot>(i.approvedSnapshot);
  if (approved) return { label: "approved version" as const, snap: approved };
  const returned = parseSnapshot<ItemSnapshot>(i.returnedSnapshot);
  return returned ? { label: "version returned by FIEO" as const, snap: returned } : null;
}

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
  const queue = role === "FIEO" ? FIEO_ITEM_QUEUE : role === "DIC" ? DIC_ITEM_QUEUE : [];
  const pendingItems = (b.requirement?.items ?? []).filter((i) => queue.includes(i.status)).length;
  const next = role === "FIEO" || role === "DIC"
    ? await prisma.buyer.findFirst({ where: { AND: [actionWhere(role), { id: { not: b.id } }] }, orderBy: { updatedAt: "asc" }, select: { id: true } })
    : null;
  const nav = { next: next ? `${base}/${next.id}` : null, list: `${base}?status=action`, listLabel: "Waiting for my decision" };

  return (
    <>
      <PageHeader
        back={backFor(base, "Back to buyers")}
        eyebrow={<>{b.regNo}{b.approvedNo && <> · <span className="text-brand-700">{b.approvedNo}</span></>}</>}
        title={b.name}
        subtitle={`${b.country} · Login ${b.user.username}`}
        actions={<><StatusBadge status={b.status} /><DownloadButtons href={`/api/reports/buyer-profile?buyerId=${b.id}`} label="Buyer profile" compact /></>}
      />
      {(basicPending || pendingItems > 0) && (
        // On phones the decision panels sit below the long details; offer a shortcut.
        <a href={basicPending ? "#decision" : "#sectors"}
          className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 lg:hidden">
          {basicPending ? "Go to the basic details decision" : `Go to the ${pendingItems} sector${pendingItems > 1 ? "s" : ""} to decide`}
          <span aria-hidden>↓</span>
        </a>
      )}
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
          {b.requirement ? <SourcingProfileView req={b.requirement} before={parseSnapshot<ProfileSnapshot>(b.requirement.approvedProfile)} /> : <Alert tone="slate">The buyer has not started the detailed requirement yet.</Alert>}
        </div>

        <div className="space-y-6">
          {role === "FIEO" && b.status !== "APPROVED" && (
            // Stays mounted so the confirmation remains visible after the status moves on.
            <Card id="decision" className={basicPending ? "no-print scroll-mt-24 border-brand-200 p-5 ring-2 ring-brand-100" : "no-print scroll-mt-24 p-5"}>
              <ReviewPanel
                buyerId={b.id}
                nav={nav}
                heading={basicPending ? "Verify basic details" : "Basic details"}
                note={basicPending
                  ? "Check the buyer's identity, contact and documents. Approving lets the buyer add sector requirements."
                  : b.status === "BASIC_APPROVED"
                    ? "Approved. The buyer's sector requirements are reviewed below, one sector at a time."
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
            <div className="max-h-[560px] overflow-y-auto p-5 pb-8 [mask-image:linear-gradient(to_bottom,black_88%,transparent)]"><Timeline logs={b.reviewLogs} /></div>
          </Card>
        </div>
      </div>

      <div id="sectors" className="mt-8 scroll-mt-24">
        <ItemReview
          buyerId={b.id}
          nav={nav}
          role={role}
          items={(b.requirement?.items ?? []).map((i) => ({
            id: i.id, sectorId: i.sectorId, sectorName: i.sector.name, status: i.status, everApproved: i.everApproved,
            baseline: baselineFor(i),
            products: i.products, specifications: i.specifications, certifications: parseCerts(i.certifications), quantity: i.quantity,
            history: i.reviewLogs.map((l) => ({ id: l.id, action: l.action, actorRole: l.actorRole, comment: l.comment, at: fmtDateTime(l.createdAt) })),
          }))}
        />
      </div>
    </>
  );
}
