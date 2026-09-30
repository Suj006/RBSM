import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Clock, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { Alert, ButtonLink, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { JourneyStepper } from "@/components/journey";
import { Timeline } from "@/components/timeline";
import { StatusBadge } from "@/components/status-badge";
import { EVENT } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import type { BuyerStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Buyer dashboard" };

const NEXT_STEP: Record<BuyerStatus, { title: string; body: string; href?: string; cta?: string; tone: "blue" | "amber" | "red" | "green" | "violet" }> = {
  SIGNED_UP: { title: "Complete your basic details", body: "Add your point of contact and upload your company profile and organisation credentials, then submit them to FIEO.", href: "/buyer/profile", cta: "Fill basic details", tone: "blue" },
  BASIC_RETURNED: { title: "Basic details need correction", body: "FIEO has returned your basic details. Please review the comment, update and submit again.", href: "/buyer/profile", cta: "Update basic details", tone: "red" },
  BASIC_SUBMITTED: { title: "Under FIEO verification", body: "Your basic details are with FIEO. You'll receive an e-mail once they are approved.", tone: "amber" },
  BASIC_APPROVED: { title: "Submit your detailed requirement", body: "Your basic details are approved. Tell us which sectors and products you want to source.", href: "/buyer/requirement", cta: "Fill detailed requirement", tone: "blue" },
  REQ_RETURNED: { title: "Requirement needs correction", body: "FIEO has returned your detailed requirement. Please review the comment, update and submit again.", href: "/buyer/requirement", cta: "Update requirement", tone: "red" },
  REQ_SUBMITTED: { title: "Awaiting FIEO recommendation", body: "FIEO is reviewing your detailed requirement.", tone: "amber" },
  DIC_RETURNED: { title: "Under re-verification", body: "Your application is being re-verified by FIEO.", tone: "amber" },
  FIEO_RECOMMENDED: { title: "Awaiting Directorate approval", body: "FIEO has recommended your registration to the Directorate of Industries & Commerce.", tone: "violet" },
  APPROVED: { title: "You are an approved RBSM buyer", body: "Your registration is complete. Matchmaking and B2B meeting schedules will be shared soon.", tone: "green" },
};

export default async function BuyerDashboard() {
  const { buyer: b } = await requireBuyer();
  const [logs, requirement, docs] = await Promise.all([
    prisma.reviewLog.findMany({ where: { buyerId: b.id }, orderBy: { createdAt: "desc" }, include: { actor: { select: { displayName: true } } } }),
    prisma.requirement.findUnique({ where: { buyerId: b.id }, include: { items: { include: { sector: true } } } }),
    prisma.document.count({ where: { buyerId: b.id } }),
  ]);
  // Buyers see only comments addressed to them (not DIC → FIEO internal notes).
  const visibleLogs = logs.map((l) => (l.action === "DIC_RETURNED" ? { ...l, comment: null } : l));
  const lastReturn = logs.find((l) => l.action === "BASIC_RETURNED" || l.action === "REQ_RETURNED");
  const step = NEXT_STEP[b.status];
  const Icon = b.status === "APPROVED" ? BadgeCheck : step.tone === "red" ? AlertTriangle : step.href ? ArrowRight : Clock;

  return (
    <>
      <PageHeader
        eyebrow={`${EVENT.name} · ${EVENT.short}`}
        title={`Welcome, ${b.name}`}
        subtitle={<>Registration no. <span className="font-semibold text-ink">{b.regNo}</span>{b.approvedNo && <> · Buyer no. <span className="font-semibold text-brand-700">{b.approvedNo}</span></>}</>}
        actions={<StatusBadge status={b.status} />}
      />

      <Card className="mb-6 p-5 sm:p-6"><JourneyStepper status={b.status} /></Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-6" /></div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-ink">{step.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{step.body}</p>
              </div>
              {step.href && <ButtonLink href={step.href}>{step.cta} <ArrowRight className="size-4" /></ButtonLink>}
            </div>
            {(b.status === "BASIC_RETURNED" || b.status === "REQ_RETURNED") && lastReturn?.comment && (
              <div className="border-t border-slate-100 px-6 py-4">
                <Alert tone="red" title="Comment from FIEO">{lastReturn.comment}</Alert>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Registration summary" />
            <div className="p-6">
              <DL cols={3} items={[
                { label: "Country", value: b.country },
                { label: "Point of contact", value: b.pocName && `${b.pocName}${b.pocDesignation ? `, ${b.pocDesignation}` : ""}` },
                { label: "Contact e-mail", value: b.pocEmail ?? b.signupEmail },
                { label: "Documents uploaded", value: `${docs} of 2` },
                { label: "Sectors of interest", value: requirement?.items.map((i) => i.sector.name).join(", ") },
                { label: "Registered on", value: fmtDate(b.createdAt) },
              ]} />
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Activity" />
          <div className="max-h-[480px] overflow-y-auto p-6"><Timeline logs={visibleLogs} /></div>
        </Card>
      </div>
    </>
  );
}
