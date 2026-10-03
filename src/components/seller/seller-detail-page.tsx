import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { backFor } from "@/components/nav/back-target";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sellerScope, sellerWhere } from "@/lib/seller-query";
import { localBodyLabel } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { ROLE_LABEL, SELLER_ACTION_LABEL, SELLER_DISTRICT_EDITABLE } from "@/lib/status";
import { Alert, Badge, ButtonLink, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { SellerBadge } from "./seller-badge";
import { DIRECTORATE_OPTIONS, DISTRICT_OPTIONS, SellerDecision } from "./seller-decision";
import { cn } from "@/lib/cn";

const DONE: Record<string, string> = {
  registered: "Seller registered. Review the details and recommend to the Directorate when ready.",
  updated: "Details updated.",
  recommended: "Saved and recommended to the Directorate.",
};

export async function SellerDetailPage({ user, id, base, done }: { user: User; id: string; base: string; done?: string }) {
  const s = await prisma.seller.findFirst({
    where: { AND: [{ id }, sellerScope(user)] },
    include: {
      products: { orderBy: { sortOrder: "asc" }, include: { sector: true } },
      logs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { displayName: true } } } },
      user: { select: { username: true, lastLoginAt: true } },
      createdBy: { select: { displayName: true } },
    },
  });
  if (!s) notFound();
  const lastReturn = s.logs.find((l) => l.action === "RETURNED");
  const lastSentBack = s.logs.find((l) => l.action === "SENT_TO_SELLER");
  const districtCan = user.role === "DISTRICT" && SELLER_DISTRICT_EDITABLE.includes(s.status);
  const dicCan = user.role === "DIC" && s.status === "RECOMMENDED";
  const next = user.role === "DISTRICT" || user.role === "DIC"
    ? await prisma.seller.findFirst({ where: { AND: [sellerWhere(user, { status: "action" }), { id: { not: s.id } }] }, orderBy: { updatedAt: "asc" }, select: { id: true } })
    : null;
  const nav = { next: next ? `${base}/${next.id}` : null, list: `${base}?status=action`, listLabel: "Needs my action" };

  return (
    <>
      <PageHeader
        back={backFor(base, "Back to sellers")}
        eyebrow={<>{s.regNo}{s.approvedNo && <> · <span className="text-brand-700">{s.approvedNo}</span></>}</>}
        title={s.name}
        subtitle={`${s.district} · ${s.taluk} · ${s.udyamNo}`}
        actions={<><SellerBadge status={s.status} /><DownloadButtons href={`/api/reports/seller-profile?sellerId=${s.id}`} label="Seller profile" compact /></>}
      />
      {done && DONE[done] && <Alert tone="green" className="mb-6">{DONE[done]}</Alert>}
      {s.status === "RETURNED" && lastReturn?.comment && (
        <Alert tone="red" className="mb-6" title="Returned by the Directorate">{lastReturn.comment}</Alert>
      )}
      {s.status === "WITH_SELLER" && (
        <Alert tone="blue" className="mb-6" title={`With the applicant for correction${lastSentBack ? ` since ${fmtDateTime(lastSentBack.createdAt)}` : ""}`}>
          {lastSentBack?.comment && <>&ldquo;{lastSentBack.comment}&rdquo; </>}
          The applicant corrects the details with their login ({s.user?.username ?? "—"}); the registration comes back to the district centre when they resubmit.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Enterprise details"
              action={districtCan ? <ButtonLink href={`${base}/${s.id}/edit`} variant="secondary" className="px-3 py-2"><Pencil className="size-4" /> Edit</ButtonLink> : undefined} />
            <div className="p-6">
              <DL cols={3} items={[
                { label: "Name of the seller", value: s.name },
                { label: "Udyam number", value: <span className="font-mono">{s.udyamNo}</span> },
                { label: "Export experience", value: s.exportExperience ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">No</Badge> },
                { label: "District", value: s.district },
                { label: "Taluk", value: s.taluk },
                { label: "Local body", value: `${s.localBodyName} ${localBodyLabel(s.localBodyType)}` },
              ]} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Promoter / contact person" />
            <div className="p-6">
              <DL cols={2} items={[
                { label: "Name", value: s.contactName },
                { label: "E-mail ID", value: <a href={`mailto:${s.contactEmail}`} className="text-brand-700 hover:underline">{s.contactEmail}</a> },
                { label: "Mobile number", value: fmtMobile(s.contactMobile) },
                { label: "WhatsApp number", value: fmtMobile(s.contactWhatsapp) },
              ]} />
            </div>
          </Card>
          <Card>
            <CardHeader title={`Sectors & products ready to export (${s.products.length})`} />
            <ul className="divide-y divide-slate-100">
              {s.products.map((p) => (
                <li key={p.id} className="grid gap-1 px-6 py-4 sm:grid-cols-[240px_1fr]">
                  <div className="font-semibold text-ink">{p.sector.name}</div>
                  <div className="text-sm text-slate-700">{p.products}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Registration" />
            <div className="p-6">
              <DL cols={3} items={[
                { label: "Source", value: s.source === "SELF" ? "Self-registered on the portal" : s.source === "BULK" ? "Bulk upload by district centre" : "Entered by district centre" },
                { label: "Registered on", value: fmtDateTime(s.createdAt) },
                { label: "Recommended on", value: fmtDateTime(s.recommendedAt) },
                { label: "Approved on", value: fmtDateTime(s.approvedAt) },
                { label: "Seller login", value: s.user ? <span className="font-mono">{s.user.username}</span> : "Allotted on approval" },
                { label: "Login", value: s.user ? <><span className="font-mono">{s.user.username}</span>{s.status !== "APPROVED" && <span className="text-slate-500"> (applicant — status and corrections only)</span>}</> : "Allotted on approval" },
                { label: "Last login", value: s.user ? fmtDateTime(s.user.lastLoginAt) : "—" },
              ]} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {(user.role === "DISTRICT" || user.role === "DIC") && (
            <Card className={cn("no-print p-5", (districtCan || dicCan) && "border-brand-200 ring-2 ring-brand-100")}>
              {districtCan ? (
                <SellerDecision sellerId={s.id} options={DISTRICT_OPTIONS} nav={nav}
                  heading={s.status === "RETURNED" ? "Correct and recommend again" : "Recommend to Directorate"}
                  note="Verify the Udyam number and contact details before recommending." />
              ) : dicCan ? (
                <SellerDecision sellerId={s.id} options={DIRECTORATE_OPTIONS} nav={nav} heading="Directorate decision"
                  note="Approving adds the seller to the RBSM seller list and e-mails a login to the contact person." />
              ) : (
                <SellerDecision sellerId={s.id} options={[]} heading="No action pending" note="This seller is not at a stage that needs your decision." />
              )}
            </Card>
          )}
          <Card>
            <CardHeader title="Activity & comments" />
            <ol className="relative space-y-5 border-l border-slate-200 p-5 pl-10">
              {s.logs.map((l) => (
                <li key={l.id} className="relative">
                  <span className={cn("absolute -left-[26px] top-1 size-3 rounded-full ring-4 ring-white",
                    l.action === "APPROVED" ? "bg-tx-green" : l.action === "RETURNED" || l.action === "REJECTED" ? "bg-tx-red" : l.action === "RECOMMENDED" ? "bg-violet-500" : "bg-tx-blue")} />
                  <div className="text-sm font-semibold text-ink">{SELLER_ACTION_LABEL[l.action]}</div>
                  <div className="text-xs text-slate-500">
                    {l.actorRole ? `${ROLE_LABEL[l.actorRole]}${l.actor ? ` · ${l.actor.displayName}` : ""}` : "Seller"} · {fmtDateTime(l.createdAt)}
                  </div>
                  {l.comment && <blockquote className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{l.comment}</blockquote>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
