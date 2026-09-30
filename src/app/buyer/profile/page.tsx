import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { Alert, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { BasicForm } from "@/components/buyer/basic-form";
import { DocLink } from "@/components/doc-link";
import { StatusBadge } from "@/components/status-badge";
import { canEditBasic } from "@/lib/status";
import { ACCEPT_ATTR } from "@/lib/storage";

export const metadata: Metadata = { title: "Basic details" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { buyer: b } = await requireBuyer();
  const { welcome } = await searchParams;
  const docList = await prisma.document.findMany({ where: { buyerId: b.id } });
  const docs = {
    PROFILE: docList.find((d) => d.kind === "PROFILE") ?? null,
    CREDENTIALS: docList.find((d) => d.kind === "CREDENTIALS") ?? null,
  };
  const editable = canEditBasic(b.status);
  const lastReturn = b.status === "BASIC_RETURNED"
    ? await prisma.reviewLog.findFirst({ where: { buyerId: b.id, action: "BASIC_RETURNED" }, orderBy: { createdAt: "desc" } })
    : null;

  return (
    <>
      <PageHeader eyebrow={b.regNo} title="Basic details" subtitle="Submitted to FIEO for verification before you can register your sourcing requirement." actions={<StatusBadge status={b.status} />} />
      {welcome && editable && (
        <Alert tone="green" className="mb-6" title="Password changed">Now complete your basic details and submit them to FIEO.</Alert>
      )}
      {lastReturn?.comment && <Alert tone="red" className="mb-6" title="Returned by FIEO">{lastReturn.comment}</Alert>}

      {editable ? (
        <BasicForm
          buyer={{ name: b.name, country: b.country, pocName: b.pocName, pocDesignation: b.pocDesignation, pocEmail: b.pocEmail, pocMobile: b.pocMobile }}
          docs={docs}
          accept={ACCEPT_ATTR}
        />
      ) : (
        <Card>
          <CardHeader title="Submitted details" icon={<Lock className="size-4" />}
            subtitle={b.status === "BASIC_SUBMITTED" ? "Submitted to FIEO for approval — locked while under review." : "Approved by FIEO."} />
          <div className="space-y-6 p-6">
            <DL items={[
              { label: "Name of the buyer", value: b.name },
              { label: "Country", value: b.country },
              { label: "Contact name", value: b.pocName },
              { label: "Designation", value: b.pocDesignation },
              { label: "E-mail ID", value: b.pocEmail },
              { label: "Mobile number", value: b.pocMobile },
            ]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Company profile</div><DocLink doc={docs.PROFILE} /></div>
              <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Organisation credentials</div><DocLink doc={docs.CREDENTIALS} /></div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
