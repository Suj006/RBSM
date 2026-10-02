import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Handshake } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { SellerBadge } from "@/components/seller/seller-badge";
import { EVENT, localBodyLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { fmtMobile } from "@/lib/text";

export const metadata: Metadata = { title: "Seller dashboard" };

export default async function Page() {
  const user = await requireUser("SELLER");
  const s = await prisma.seller.findUnique({
    where: { userId: user.id },
    include: { products: { orderBy: { sortOrder: "asc" }, include: { sector: true } } },
  });
  if (!s) notFound();
  return (
    <>
      <PageHeader eyebrow={`${EVENT.name} · ${EVENT.short}`} title={`Welcome, ${s.name}`}
        subtitle={<>Seller no. <span className="font-semibold text-brand-700">{s.approvedNo}</span> · Registration no. <span className="font-semibold text-ink">{s.regNo}</span></>}
        actions={<SellerBadge status={s.status} />} />

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
        <div className="space-y-6 lg:col-span-2">
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
        <Card>
          <CardHeader title="Buyer meetings" icon={<CalendarClock className="size-4" />} />
          <div className="p-6 text-sm text-slate-500">
            Matchmaking with international buyers is in progress. Matched buyers and B2B meeting slots will be listed here.
          </div>
        </Card>
      </div>
    </>
  );
}
