import { Plus, Search, Upload } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import type { SellerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { sellerWhere, type SellerFilters } from "@/lib/seller-query";
import { ALL_SELLER_STATUSES, SELLER_META, SELLER_VISIBLE } from "@/lib/status";
import { DISTRICT_NAMES } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { Button, ButtonLink, Card, Input, PageHeader, Select } from "@/components/ui";
import { Pagination } from "@/components/staff/pagination";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { SellerTable } from "./seller-table";

const PAGE_SIZE = 25;

export async function SellerListPage({ user, base, filters, title, subtitle }: {
  user: User; base: string; filters: SellerFilters; title: string; subtitle: string;
}) {
  const where = sellerWhere(user, filters);
  const page = Math.max(1, Number(filters.page) || 1);
  const [rows, total, sectors] = await Promise.all([
    prisma.seller.findMany({
      where, orderBy: [{ updatedAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { products: { orderBy: { sortOrder: "asc" }, include: { sector: { select: { name: true } } } } },
    }),
    prisma.seller.count({ where }),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const statuses: SellerStatus[] = user.role === "DISTRICT" || user.role === "ADMIN" || user.role === "DIC" ? ALL_SELLER_STATUSES : SELLER_VISIBLE[user.role] ?? [];
  const { page: _p, ...rest } = filters;
  void _p;
  const qs = new URLSearchParams(Object.entries(rest).filter(([, v]) => v) as [string, string][]).toString();
  const bulk =
    user.role === "DISTRICT" ? { decision: "recommend" as const, label: "Recommend to Directorate", eligible: ["WITH_DISTRICT", "RETURNED"] as SellerStatus[] }
    : user.role === "DIC" ? { decision: "approve" as const, label: "Approve selected", eligible: ["RECOMMENDED"] as SellerStatus[] }
    : undefined;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {user.role === "DISTRICT" && (
              <>
                <ButtonLink href="/district/sellers/new"><Plus className="size-4" /> Add seller</ButtonLink>
                <ButtonLink href="/district/upload" variant="secondary"><Upload className="size-4" /> Bulk upload</ButtonLink>
              </>
            )}
            <DownloadButtons href={`/api/reports/seller-register${qs ? `?${qs}` : ""}`} label="Seller register" compact />
          </div>
        } />
      <Card className="overflow-hidden">
        <form action={base} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.3fr_1.4fr_1fr_1fr_1.1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={filters.q} placeholder="Search name, Udyam, reg. no., mobile…" className="pl-9" aria-label="Search" />
          </div>
          <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status">
            <option value="">All statuses</option>
            {(user.role === "DISTRICT" || user.role === "DIC") && <option value="action">⚑ Needs my action</option>}
            {statuses.map((s) => <option key={s} value={s}>{SELLER_META[s].label}</option>)}
          </Select>
          <Select name="sector" defaultValue={filters.sector ?? ""} aria-label="Sector">
            <option value="">All sectors</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          {user.role !== "DISTRICT" ? (
            <Select name="district" defaultValue={filters.district ?? ""} aria-label="District">
              <option value="">All districts</option>
              {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
            </Select>
          ) : (
            <Select name="source" defaultValue={filters.source ?? ""} aria-label="Source">
              <option value="">All sources</option>
              <option value="DISTRICT">Entered by district centre</option>
              <option value="BULK">Bulk upload</option>
              <option value="SELF">Self-registered</option>
            </Select>
          )}
          <Select name="exp" defaultValue={filters.exp ?? ""} aria-label="Export experience">
            <option value="">Any export experience</option>
            <option value="yes">Export experience: Yes</option>
            <option value="no">Export experience: No</option>
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
        <SellerTable
          base={base}
          bulk={bulk}
          rows={rows.map((s) => ({
            id: s.id, regNo: s.regNo, approvedNo: s.approvedNo, name: s.name, district: s.district, taluk: s.taluk,
            udyamNo: s.udyamNo, exportExperience: s.exportExperience, contactName: s.contactName, mobile: fmtMobile(s.contactMobile),
            status: s.status, source: s.source, sectors: s.products.map((p) => p.sector.name), updated: fmtDate(s.updatedAt),
          }))}
        />
        <Pagination base={base} params={rest} page={page} total={total} pageSize={PAGE_SIZE} />
      </Card>
    </>
  );
}
