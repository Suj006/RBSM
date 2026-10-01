import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock, AlertTriangle, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { Alert, Badge, ButtonLink, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { JourneyStepper } from "@/components/journey";
import { Timeline } from "@/components/timeline";
import { StatusBadge } from "@/components/status-badge";
import { EVENT } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { ITEM_META } from "@/lib/status";
import type { BuyerStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Buyer dashboard" };

type Step = { title: string; body: string; href?: string; cta?: string; tone: "blue" | "amber" | "red" | "green" };

const BASIC_STEP: Partial<Record<BuyerStatus, Step>> = {
  SIGNED_UP: { title: "Complete your basic details", body: "Add your point of contact and upload your company profile and organisation credentials, then submit them to FIEO.", href: "/buyer/profile", cta: "Fill basic details", tone: "blue" },
  BASIC_RETURNED: { title: "Basic details need correction", body: "FIEO has returned your basic details. Please review the comment, update and submit again.", href: "/buyer/profile", cta: "Update basic details", tone: "red" },
  BASIC_SUBMITTED: { title: "Under FIEO verification", body: "Your basic details are with FIEO. You'll receive an e-mail once they are approved.", tone: "amber" },
};

export default async function BuyerDashboard() {
  const { buyer: b } = await requireBuyer();
  const [logs, requirement, docs] = await Promise.all([
    prisma.reviewLog.findMany({ where: { buyerId: b.id }, orderBy: { createdAt: "desc" }, include: { actor: { select: { displayName: true } } } }),
    prisma.requirement.findUnique({ where: { buyerId: b.id }, include: { items: { orderBy: { sortOrder: "asc" }, include: { sector: true } } } }),
    prisma.document.count({ where: { buyerId: b.id } }),
  ]);
  // Buyers see only comments addressed to them (not internal FIEO ↔ DIC notes).
  const visibleLogs = logs.map((l) => (l.action === "DIC_RETURNED" || l.action === "FIEO_RECOMMENDED" || l.action === "DIC_APPROVED" ? { ...l, comment: null } : l));
  const lastBasicReturn = logs.find((l) => l.action === "BASIC_RETURNED");
  const items = requirement?.items ?? [];
  const n = (...s: (keyof typeof ITEM_META)[]) => items.filter((i) => s.includes(i.status)).length;

  const step: Step = BASIC_STEP[b.status] ?? (
    n("FIEO_RETURNED") ? { title: `${n("FIEO_RETURNED")} sector${n("FIEO_RETURNED") > 1 ? "s" : ""} returned for correction`, body: "FIEO has returned some of your sector requirements. Review the comments, update and submit again. Other sectors are not affected.", href: "/buyer/requirement", cta: "Update requirements", tone: "red" }
    : n("DRAFT") ? { title: `${n("DRAFT")} draft sector${n("DRAFT") > 1 ? "s" : ""} not yet submitted`, body: "Submit your draft sector requirements to FIEO for recommendation.", href: "/buyer/requirement", cta: "Review and submit", tone: "blue" }
    : !items.length ? { title: "Add your sector requirements", body: "Your basic details are approved. Tell us which sectors and products you want to source — each sector is approved separately.", href: "/buyer/requirement", cta: "Add requirements", tone: "blue" }
    : n("SUBMITTED", "FIEO_RECOMMENDED", "DIC_RETURNED") ? { title: `${n("SUBMITTED", "FIEO_RECOMMENDED", "DIC_RETURNED")} sector${n("SUBMITTED", "FIEO_RECOMMENDED", "DIC_RETURNED") > 1 ? "s" : ""} under review`, body: b.status === "APPROVED" ? "You are an approved buyer. The sectors below are being reviewed; you'll be notified by e-mail." : "Your sector requirements are with FIEO and the Directorate. You'll be notified by e-mail.", tone: "amber" }
    : { title: "You are an approved RBSM buyer", body: "All your sectors are approved. You can add new sectors or modify approved ones at any time — changes go through the same approval.", href: "/buyer/requirement", cta: "Manage requirements", tone: "green" }
  );
  const Icon = step.tone === "green" ? BadgeCheck : step.tone === "red" ? AlertTriangle : step.href ? ArrowRight : Clock;

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
            {b.status === "BASIC_RETURNED" && lastBasicReturn?.comment && (
              <div className="border-t border-slate-100 px-6 py-4">
                <Alert tone="red" title="Comment from FIEO">{lastBasicReturn.comment}</Alert>
              </div>
            )}
          </Card>

          {(b.status === "BASIC_APPROVED" || b.status === "APPROVED") && (
            <Card>
              <CardHeader title="My sectors" subtitle="Approval status of each sector requirement"
                action={<Link href="/buyer/requirement" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><Plus className="size-4" /> Add / modify</Link>} />
              <ul className="divide-y divide-slate-100">
                {items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{i.sector.name}</div>
                      <div className="truncate text-xs text-slate-500">{i.products}</div>
                    </div>
                    <Badge tone={ITEM_META[i.status].tone}>{ITEM_META[i.status].label}</Badge>
                  </li>
                ))}
                {!items.length && <li className="px-6 py-6 text-sm text-slate-500">No sectors added yet.</li>}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Registration summary" />
            <div className="p-6">
              <DL cols={3} items={[
                { label: "Country", value: b.country },
                { label: "Point of contact", value: b.pocName && `${b.pocName}${b.pocDesignation ? `, ${b.pocDesignation}` : ""}` },
                { label: "Contact e-mail", value: b.pocEmail ?? b.signupEmail },
                { label: "Documents uploaded", value: `${docs} of 2` },
                { label: "Approved sectors", value: `${n("APPROVED")} of ${items.length}` },
                { label: "Registered on", value: fmtDate(b.createdAt) },
              ]} />
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Activity" />
          <div className="max-h-[560px] overflow-y-auto p-6 pb-8 [mask-image:linear-gradient(to_bottom,black_88%,transparent)]"><Timeline logs={visibleLogs} /></div>
        </Card>
      </div>
    </>
  );
}
