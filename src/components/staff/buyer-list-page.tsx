import { FileSpreadsheet } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { buyerWhere, PAGE_SIZE, scopeFor, type BuyerFilters as F } from "@/lib/buyer-query";
import { ALL_STATUSES, DIC_VISIBLE } from "@/lib/status";
import { Card, PageHeader } from "@/components/ui";
import { BuyerFilters } from "./buyer-filters";
import { BuyerTable } from "./buyer-table";
import { Pagination } from "./pagination";

export async function BuyerListPage({ role, base, filters, title, subtitle }: {
  role: Role; base: string; filters: F; title: string; subtitle: string;
}) {
  const where = buyerWhere(role, filters);
  const page = Math.max(1, Number(filters.page) || 1);
  const [rows, total, countries, sectors] = await Promise.all([
    prisma.buyer.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { username: true } }, requirement: { select: { items: { select: { sector: { select: { name: true } } } } } } },
    }),
    prisma.buyer.count({ where }),
    prisma.buyer.findMany({ where: scopeFor(role), distinct: ["country"], select: { country: true }, orderBy: { country: "asc" } }),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const { page: _p, ...rest } = filters;
  void _p;
  const qs = new URLSearchParams(Object.entries(rest).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <a href={`/api/export/buyers?${qs}`} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
              <FileSpreadsheet className="size-4 text-brand-700" /> Buyers (Excel/CSV)
            </a>
            <a href={`/api/export/requirements?${qs}`} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
              <FileSpreadsheet className="size-4 text-tx-blue" /> Sector-wise requirements
            </a>
          </>
        }
      />
      <Card className="overflow-hidden">
        <BuyerFilters
          action={base}
          filters={filters}
          statuses={role === "DIC" ? DIC_VISIBLE : ALL_STATUSES}
          countries={countries.map((c) => c.country)}
          sectors={sectors}
          actionLabel={role === "DIC" ? "Awaiting my approval" : "Needs FIEO action"}
        />
        <BuyerTable rows={rows} base={base} />
        <Pagination base={base} params={rest} page={page} total={total} pageSize={PAGE_SIZE} />
      </Card>
    </>
  );
}
