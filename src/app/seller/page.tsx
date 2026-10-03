import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Handshake, Star } from "lucide-react";
import { SellerMeetings } from "@/components/match/my-matches";
import { getMatchState } from "@/lib/matchmaking";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, Badge, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { SellerBadge } from "@/components/seller/seller-badge";
import { ApplicantView } from "@/components/seller/applicant-view";
import { EVENT, localBodyLabel } from "@/lib/config";
import { fmtDate, withinDays } from "@/lib/format";
import { fmtMobile } from "@/lib/text";

export const metadata: Metadata = { title: "Seller portal" };

export default async function Page({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser("SELLER");
  const { done } = await searchParams;
  const s = await prisma.seller.findUnique({
    where: { userId: user.id },
    include: {
      products: { orderBy: { sortOrder: "asc" }, include: { sector: true } },
      logs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!s) notFound();
  // Until the Directorate approves, the login is a temporary applicant login: status and corrections only.
  if (s.status !== "APPROVED") return <ApplicantView seller={s} done={done} />;
  const match = await getMatchState();
  return (
    <>
      <PageHeader eyebrow={`${EVENT.name} · ${EVENT.short}`} title={`Welcome, ${s.name}`}
        subtitle={<>Seller no. <span className="font-semibold text-brand-700">{s.approvedNo}</span> · Registration no. <span className="font-semibold text-ink">{s.regNo}</span></>}
        actions={<SellerBadge status={s.status} />} />
      {withinDays(s.approvedAt, 14) && (
        <Alert tone="green" className="mb-6" title="Welcome — your registration has been approved">
          This login is now your permanent seller login. Your seller number is {s.approvedNo}.
        </Alert>
      )}

      {match.buyersVisible && !s.prefSubmittedAt && !match.prefsFrozen && (
        <Link href="/seller/buyers" className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-violet-50 px-5 py-4 text-violet-900 ring-1 ring-violet-200 hover:bg-violet-100">
          <span className="flex items-center gap-3"><Star className="size-5 shrink-0" />
            <span><b>Approved international buyers are now listed.</b> See what they need and choose up to 5 as your tentative preferences.</span></span>
          <span className="shrink-0 text-sm font-semibold">Choose preferences →</span>
        </Link>
      )}
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Handshake className="size-6" /></div>
          <div>
            <h2 className="text-lg font-bold text-ink">You are an approved RBSM seller</h2>
            <p className="mt-1 text-sm text-slate-600">
              International buyers will be matched with sellers based on their product requirements. Your buyer meetings and schedule will appear here.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Sectors & products ready to export" />
            <ul className="divide-y divide-slate-100">
              {s.products.map((p) => (
                <li key={p.id} className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr]">
                  <div className="font-semibold text-ink">{p.sector.name}</div>
                  <div className="text-sm text-slate-700">{p.products}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Registration details" subtitle="To change these details, please contact your District Industries Centre." />
            <div className="p-6">
              <DL cols={3} items={[
                { label: "Udyam number", value: <span className="font-mono">{s.udyamNo}</span> },
                { label: "District", value: s.district },
                { label: "Taluk", value: s.taluk },
                { label: "Local body", value: `${s.localBodyName} ${localBodyLabel(s.localBodyType)}` },
                { label: "Export experience", value: s.exportExperience ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">No</Badge> },
                { label: "Approved on", value: fmtDate(s.approvedAt) },
                { label: "Contact person", value: s.contactName },
                { label: "Mobile / WhatsApp", value: `${fmtMobile(s.contactMobile)}${s.contactWhatsapp !== s.contactMobile ? ` / ${fmtMobile(s.contactWhatsapp)}` : ""}` },
                { label: "E-mail ID", value: s.contactEmail },
              ]} />
            </div>
          </Card>
        </div>
        <SellerMeetings sellerId={s.id} />
      </div>
    </>
  );
}
