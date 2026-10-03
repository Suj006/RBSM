import { Check, Clock, Lock, XCircle } from "lucide-react";
import type { Seller, SellerLog, SellerProduct, Sector } from "@/generated/prisma/client";
import type { SellerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { Alert, Badge, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { SellerBadge } from "./seller-badge";
import { SellerForm } from "./seller-form";
import { EVENT, localBodyLabel } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { SELLER_ACTION_LABEL, SELLER_APPLICANT_EDITABLE } from "@/lib/status";
import { sellerFormValues } from "@/lib/seller-form-defaults";
import { cn } from "@/lib/cn";

type Full = Seller & { products: (SellerProduct & { sector: Sector })[]; logs: SellerLog[] };

const STEPS = ["Registered", "District verification", "Directorate approval", "Approved seller"];
const STEP: Record<SellerStatus, number> = { WITH_DISTRICT: 1, WITH_SELLER: 1, RETURNED: 1, RECOMMENDED: 2, APPROVED: 3, REJECTED: -1 };

// Entries an applicant sees; internal Directorate ↔ district exchanges are left out.
const APPLICANT_LOG = new Set(["REGISTERED", "SENT_TO_SELLER", "RESUBMITTED", "RECOMMENDED", "APPROVED", "REJECTED"]);

const DONE: Record<string, string> = {
  resubmitted: "Thank you. Your corrected details have been sent back to the District Industries Centre.",
  updated: "Your details have been updated.",
};

/** The seller portal before approval: application status, corrections and resubmission. */
export async function ApplicantView({ seller: s, done }: { seller: Full; done?: string }) {
  const editable = SELLER_APPLICANT_EDITABLE.includes(s.status);
  const sentBack = s.logs.find((l) => l.action === "SENT_TO_SELLER");
  const rejected = s.logs.find((l) => l.action === "REJECTED");
  const sectors = editable
    ? await prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } })
    : [];
  const step = STEP[s.status];

  return (
    <>
      <PageHeader eyebrow={`${EVENT.name} · ${EVENT.short} · Registration no. ${s.regNo}`} title="Your seller application"
        subtitle={s.name} actions={<SellerBadge status={s.status} />} />
      {done && DONE[done] && <Alert tone="green" className="mb-6">{DONE[done]}</Alert>}

      {/* Progress */}
      {step >= 0 && (
        <Card className="mb-6 p-5 sm:p-6">
          <ol className="grid grid-cols-4 gap-2">
            {STEPS.map((label, i) => {
              const state = i < step ? "done" : i === step ? "current" : "todo";
              return (
                <li key={label} className="flex flex-col items-center text-center">
                  <span className={cn("grid size-9 place-items-center rounded-full text-sm font-bold",
                    state === "done" ? "bg-brand-600 text-white" : state === "current" ? "bg-tx-yellow text-ink ring-4 ring-tx-yellow/25" : "bg-slate-100 text-slate-400")}>
                    {state === "done" ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span className={cn("mt-2 text-xs font-medium sm:text-sm", state === "todo" ? "text-slate-400" : "text-ink")}>{label}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {/* What happens now */}
      {s.status === "WITH_SELLER" && (
        <Alert tone="amber" className="mb-6" title="Correction requested by your District Industries Centre">
          {sentBack?.comment && <p className="mt-1 text-base font-medium text-amber-950">&ldquo;{sentBack.comment}&rdquo;</p>}
          <p className="mt-1">Please correct the details below and click <b>Save &amp; submit to district centre</b>.</p>
        </Alert>
      )}
      {s.status === "WITH_DISTRICT" && (
        <StatusCard icon={<Clock className="size-5" />} title={`Being verified by the District Industries Centre, ${s.district}`}>
          You can still update your details below until the district centre acts on your application. You will be e-mailed if anything needs correcting.
        </StatusCard>
      )}
      {(s.status === "RECOMMENDED" || s.status === "RETURNED") && (
        <StatusCard icon={<Lock className="size-5" />} title={s.status === "RECOMMENDED" ? "Recommended to the Directorate — awaiting approval" : "Being re-checked by your District Industries Centre"}>
          Your details are locked while they are reviewed. Once the Directorate approves your registration, this login becomes your permanent seller login.
        </StatusCard>
      )}
      {s.status === "REJECTED" && (
        <Alert tone="red" className="mb-6" title="Your registration was not accepted">
          {rejected?.comment && <p className="mt-1">&ldquo;{rejected.comment}&rdquo;</p>}
          <p className="mt-1">For clarification, please contact the District Industries Centre, {s.district}.</p>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {editable ? (
            s.status === "WITH_SELLER" ? (
              <SellerForm mode="applicant" initial={sellerFormValues(s)} sectors={sectors} />
            ) : (
              <>
                <Summary s={s} />
                <details className="group rounded-2xl bg-white ring-1 ring-slate-200">
                  <summary className="cursor-pointer list-none px-6 py-4 font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Update my details…</span>
                    <span className="hidden group-open:inline">Update my details</span>
                  </summary>
                  <div className="border-t border-slate-100 p-4 sm:p-6">
                    <SellerForm mode="applicant" initial={sellerFormValues(s)} sectors={sectors} />
                  </div>
                </details>
              </>
            )
          ) : <Summary s={s} />}
        </div>

        <Card className="h-fit">
          <CardHeader title="Application history" />
          <ol className="space-y-4 p-5">
            {s.logs.filter((l) => APPLICANT_LOG.has(l.action)).map((l) => (
              <li key={l.id} className="text-sm">
                <div className="font-semibold text-ink">{l.action === "APPROVED" ? "Approved by the Directorate" : SELLER_ACTION_LABEL[l.action]}</div>
                <div className="text-xs text-slate-500">{fmtDateTime(l.createdAt)}</div>
                {l.comment && l.action !== "REGISTERED" && <div className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-700">{l.comment}</div>}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

function StatusCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-6 flex gap-4 p-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{icon}</div>
      <div>
        <div className="font-bold text-ink">{title}</div>
        <p className="mt-1 text-sm text-slate-600">{children}</p>
      </div>
    </Card>
  );
}

function Summary({ s }: { s: Full }) {
  return (
    <Card>
      <CardHeader title="Submitted details" icon={s.status === "REJECTED" ? <XCircle className="size-4" /> : undefined} />
      <div className="space-y-6 p-6">
        <DL cols={3} items={[
          { label: "Name of the seller", value: s.name },
          { label: "Udyam number", value: <span className="font-mono">{s.udyamNo}</span> },
          { label: "Export experience", value: s.exportExperience ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">No</Badge> },
          { label: "District", value: s.district },
          { label: "Taluk", value: s.taluk },
          { label: "Local body", value: `${s.localBodyName} ${localBodyLabel(s.localBodyType)}` },
          { label: "Contact person", value: s.contactName },
          { label: "Mobile / WhatsApp", value: `${fmtMobile(s.contactMobile)}${s.contactWhatsapp !== s.contactMobile ? ` / ${fmtMobile(s.contactWhatsapp)}` : ""}` },
          { label: "E-mail ID", value: s.contactEmail },
        ]} />
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sectors &amp; products ready to export</div>
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {s.products.map((p) => (
              <li key={p.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[200px_1fr]">
                <span className="font-semibold text-ink">{p.sector.name}</span><span className="text-slate-700">{p.products}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
