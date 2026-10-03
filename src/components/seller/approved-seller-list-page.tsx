import Link from "next/link";
import { BadgeCheck, Search } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { SELLER_FILTER_KEYS, sellerWhere, type SellerFilters } from "@/lib/seller-query";
import { ProfileFilters } from "./profile-filters";
import { DISTRICT_NAMES, optLabel, UNIT_CATEGORIES, UNIT_TYPES } from "@/lib/config";
import { fmtDate, parseCerts } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { Pagination } from "@/components/staff/pagination";

const PAGE_SIZE = 50;

/** RBSM seller list: every approved seller with complete details, for the central team. */
export async function ApprovedSellerListPage({ user, base, sellerBase, filters }: {
  user: User; base: string; sellerBase: string; filters: SellerFilters;
}) {
  const f = { ...filters, status: undefined };
  const where = { AND: [sellerWhere(user, f), { status: "APPROVED" as const }] };
  const page = Math.max(1, Number(filters.page) || 1);
  const [rows, total, allApproved, sectors] = await Promise.all([
    prisma.seller.findMany({
      where, orderBy: { approvedSeq: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { products: { orderBy: { sortOrder: "asc" }, include: { sector: { select: { name: true } } } } },
    }),
    prisma.seller.count({ where }),
    prisma.seller.count({ where: { status: "APPROVED" } }),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const qs = new URLSearchParams(SELLER_FILTER_KEYS.filter((k) => k !== "status" && f[k]).map((k) => [k, f[k]!])).toString();
  const { page: _p, ...rest } = f;
  void _p;

  return (
    <>
      <PageHeader eyebrow="Kerala MSME sellers" title="RBSM seller list"
        subtitle={`${allApproved} sellers approved by the Directorate${total !== allApproved ? ` · ${total} match the filters` : ""}. Download for complete details of every seller.`}
        actions={<DownloadButtons href={`/api/reports/approved-sellers${qs ? `?${qs}` : ""}`} label="Complete details" compact />} />
      <Card className="overflow-hidden">
        <form action={base} className="space-y-3 border-b border-slate-100 p-4">
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.2fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={f.q} placeholder="Search name, seller no., Udyam, mobile…" className="pl-9" aria-label="Search" />
          </div>
          <Select name="district" defaultValue={f.district ?? ""} aria-label="District">
            <option value="">All districts</option>
            {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
          </Select>
          <Select name="sector" defaultValue={f.sector ?? ""} aria-label="Sector">
            <option value="">All sectors</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select name="exp" defaultValue={f.exp ?? ""} aria-label="Export experience">
            <option value="">Any export experience</option>
            <option value="yes">Export experience: Yes</option>
            <option value="no">Export experience: No</option>
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
         </div>
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <ProfileFilters f={f} personal={user.role !== "FIEO"} />
         </div>
        </form>
        {rows.length ? (
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Promoter / contact</th><th className="px-4 py-3">Sectors &amp; products ready to export</th>
                  <th className="px-4 py-3">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s, i) => (
                  <tr key={s.id} className="align-top hover:bg-brand-50/40">
                    <td className="px-4 py-3 text-slate-500">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="w-60 px-4 py-3">
                      <Link href={`${sellerBase}/${s.id}`} className="font-semibold text-ink hover:text-brand-700">{s.name}</Link>
                      <div className="whitespace-nowrap font-mono text-[11px] font-bold text-brand-700">{s.approvedNo}</div>
                      <div className="whitespace-nowrap font-mono text-[11px] text-slate-500">{s.udyamNo}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.exportExperience ? <Badge tone="green">Export experience</Badge> : <Badge tone="slate">No export experience</Badge>}
                        {s.profileCompletedAt ? <Badge tone="blue">{[optLabel(UNIT_CATEGORIES, s.unitCategory), optLabel(UNIT_TYPES, s.unitType)].filter(Boolean).join(" · ")}</Badge> : <Badge tone="amber">Profile pending</Badge>}
                      </div>
                      {s.iecNo && <div className="mt-1 whitespace-nowrap text-[11px] text-slate-500">IEC <span className="font-mono">{s.iecNo}</span></div>}
                      {parseCerts(s.certifications).length > 0 && <div className="mt-0.5 text-[11px] text-slate-500">{parseCerts(s.certifications).join(", ")}</div>}
                      {parseCerts(s.exportCountries).length > 0 && <div className="mt-0.5 text-[11px] text-sky-700">Exported to: {parseCerts(s.exportCountries).join(", ")}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs"><div className="font-medium text-ink">{s.district}</div><div className="text-slate-500">{s.taluk}{s.block ? ` · ${s.block} block` : ""} · {s.localBodyName}</div></td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-ink">{s.contactName}</div>
                      <div className="whitespace-nowrap text-slate-500">{fmtMobile(s.contactMobile)}{s.contactWhatsapp !== s.contactMobile && <> · WA {fmtMobile(s.contactWhatsapp)}</>}</div>
                      <div className="text-slate-500">{s.contactEmail}</div>
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs">
                      {s.products.map((p) => (
                        <div key={p.id} className="mb-1 last:mb-0"><span className="font-semibold text-ink">{p.sector.name}:</span> <span className="text-slate-600">{p.products}</span></div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDate(s.approvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<BadgeCheck className="size-5" />} title={allApproved ? "No approved sellers match the filters" : "No approved sellers yet"}>
            {allApproved ? "Try changing the filters." : "Sellers appear here once the Directorate approves them."}
          </EmptyState>
        )}
        <Pagination base={base} params={rest} page={page} total={total} pageSize={PAGE_SIZE} />
      </Card>
    </>
  );
}
