import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { buyerWhere, itemScope, PAGE_SIZE, scopeFor, type BuyerFilters as F } from "@/lib/buyer-query";
import { ALL_ITEM_STATUSES, ALL_STATUSES, ITEM_META } from "@/lib/status";
import { Card, PageHeader } from "@/components/ui";
import { BuyerFilters } from "./buyer-filters";
import { BuyerTable } from "./buyer-table";
import { Pagination } from "./pagination";
import { DownloadButtons } from "./download-buttons";

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
      include: {
        user: { select: { username: true } },
        requirement: { select: { items: { where: itemScope(role), orderBy: { sortOrder: "asc" }, select: { status: true, sector: { select: { name: true } } } } } },
      },
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
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButtons href={`/api/reports/buyer-register${qs ? `?${qs}` : ""}`} label="Register" compact />
            <DownloadButtons href={`/api/reports/sector-requirements${qs ? `?${qs}` : ""}`} label="Sector-wise" compact />
          </div>
        }
      />
      <Card className="overflow-hidden">
        <BuyerFilters
          action={base}
          filters={filters}
          statuses={ALL_STATUSES}
          itemStatuses={ALL_ITEM_STATUSES}
          countries={countries.map((c) => c.country)}
          sectors={sectors}
          actionLabel={role === "DIC" ? "Awaiting my approval" : "Needs FIEO action"}
        />
        <BuyerTable rows={rows} base={base} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
          {(ALL_ITEM_STATUSES).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${ITEM_META[s].dot}`} />{ITEM_META[s].short}</span>
          ))}
        </div>
        <Pagination base={base} params={rest} page={page} total={total} pageSize={PAGE_SIZE} />
      </Card>
    </>
  );
}
