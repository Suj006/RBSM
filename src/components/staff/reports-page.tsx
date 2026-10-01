import { BarChart3, BadgeCheck, ClipboardList, Users } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { scopeFor, type BuyerFilters as F } from "@/lib/buyer-query";
import { REPORTS, type ReportId } from "@/lib/reports/data";
import { ALL_ITEM_STATUSES, ALL_STATUSES, DIC_VISIBLE_ITEMS } from "@/lib/status";
import { Card, PageHeader } from "@/components/ui";
import { BuyerFilters } from "./buyer-filters";
import { DownloadButtons } from "./download-buttons";

const ICON: Record<ReportId, typeof Users> = {
  "buyer-register": Users,
  "sector-requirements": ClipboardList,
  "approved-buyers": BadgeCheck,
  "mis-summary": BarChart3,
};
const ACCENT: Record<ReportId, string> = {
  "buyer-register": "bg-tx-blue",
  "sector-requirements": "bg-tx-yellow",
  "approved-buyers": "bg-tx-green",
  "mis-summary": "bg-tx-red",
};

export async function ReportsPage({ role, base, filters }: { role: Role; base: string; filters: F }) {
  const [countries, sectors] = await Promise.all([
    prisma.buyer.findMany({ where: scopeFor(role), distinct: ["country"], select: { country: true }, orderBy: { country: "asc" } }),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const { page: _p, ...rest } = filters;
  void _p;
  const qs = new URLSearchParams(Object.entries(rest).filter(([, v]) => v) as [string, string][]).toString();
  const filtered = qs.length > 0;
  const ids = (Object.keys(REPORTS) as ReportId[]).filter((id) => role !== "DIC" || id !== "buyer-register");

  return (
    <>
      <PageHeader eyebrow="Reports" title="Reports & downloads"
        subtitle="Formatted Excel workbooks and PDF reports with the TRADEX letterhead. Filters apply to the register, sector-wise and approved-buyer reports." />
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-ink">Filters {filtered && <a href={base} className="ml-2 text-xs font-medium text-brand-700 hover:underline">Clear</a>}</div>
        <BuyerFilters
          action={base}
          filters={filters}
          statuses={role === "DIC" ? ["BASIC_APPROVED", "APPROVED"] : ALL_STATUSES}
          itemStatuses={role === "DIC" ? DIC_VISIBLE_ITEMS : ALL_ITEM_STATUSES}
          countries={countries.map((c) => c.country)}
          sectors={sectors}
          actionLabel={role === "DIC" ? "Awaiting my approval" : "Needs FIEO action"}
        />
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        {ids.map((id) => {
          const Icon = ICON[id];
          return (
            <Card key={id} className="relative flex flex-col overflow-hidden p-6">
              <span className={`absolute inset-x-0 top-0 h-1 ${ACCENT[id]}`} />
              <div className="flex items-start gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-white"><Icon className="size-5" /></div>
                <div>
                  <h2 className="text-base font-bold text-ink">{REPORTS[id].title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{REPORTS[id].description}</p>
                  {id === "mis-summary" && <p className="mt-1 text-xs text-slate-400">Always covers the whole programme (filters not applied).</p>}
                </div>
              </div>
              <div className="mt-5 flex flex-1 items-end justify-end">
                <DownloadButtons href={`/api/reports/${id}${id === "mis-summary" || !qs ? "" : `?${qs}`}`} />
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
