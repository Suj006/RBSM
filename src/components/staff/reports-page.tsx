import { BarChart3, BadgeCheck, ClipboardList, MapPinned, Store, Users } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import type { SellerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { scopeFor, type BuyerFilters as F } from "@/lib/buyer-query";
import { REPORTS, reportsFor, type ReportId } from "@/lib/reports/data";
import { ALL_ITEM_STATUSES, ALL_SELLER_STATUSES, ALL_STATUSES, DIC_VISIBLE_ITEMS, SELLER_META, SELLER_VISIBLE } from "@/lib/status";
import { DISTRICT_NAMES } from "@/lib/config";
import { Button, Card, PageHeader, Select } from "@/components/ui";
import { BuyerFilters } from "./buyer-filters";
import { DownloadButtons } from "./download-buttons";

const ICON: Record<ReportId, typeof Users> = {
  "buyer-register": Users, "sector-requirements": ClipboardList, "approved-buyers": BadgeCheck,
  "seller-register": Store, "seller-district-summary": MapPinned, "mis-summary": BarChart3,
};
const ACCENT: Record<ReportId, string> = {
  "buyer-register": "bg-tx-blue", "sector-requirements": "bg-tx-yellow", "approved-buyers": "bg-tx-green",
  "seller-register": "bg-tx-green", "seller-district-summary": "bg-tx-blue", "mis-summary": "bg-tx-red",
};
const SELLER_REPORTS: ReportId[] = ["seller-register", "seller-district-summary"];

type Params = F & { s_status?: string; s_district?: string; s_sector?: string; s_exp?: string };

function ReportCard({ id, href, note }: { id: ReportId; href: string; note?: string }) {
  const Icon = ICON[id];
  return (
    <Card className="relative flex flex-col overflow-hidden p-6">
      <span className={`absolute inset-x-0 top-0 h-1 ${ACCENT[id]}`} />
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-white"><Icon className="size-5" /></div>
        <div>
          <h3 className="text-base font-bold text-ink">{REPORTS[id].title}</h3>
          <p className="mt-1 text-sm text-slate-500">{REPORTS[id].description}</p>
          {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
        </div>
      </div>
      <div className="mt-5 flex flex-1 items-end justify-end"><DownloadButtons href={href} /></div>
    </Card>
  );
}

export async function ReportsPage({ user, base, filters }: { user: User; base: string; filters: Params }) {
  const role = user.role;
  const allowed = reportsFor(role);
  const buyerIds = allowed.filter((id) => !SELLER_REPORTS.includes(id));
  const sellerIds = allowed.filter((id) => SELLER_REPORTS.includes(id));
  const [countries, sectors] = await Promise.all([
    buyerIds.length ? prisma.buyer.findMany({ where: scopeFor(role), distinct: ["country"], select: { country: true }, orderBy: { country: "asc" } }) : [],
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const pick = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
  const bqs = pick({ q: filters.q, status: filters.status, item: filters.item, country: filters.country, sector: filters.sector });
  const sqs = pick({ status: filters.s_status, district: filters.s_district, sector: filters.s_sector, exp: filters.s_exp });
  const sellerStatuses: SellerStatus[] = role === "DISTRICT" || role === "ADMIN" ? ALL_SELLER_STATUSES : SELLER_VISIBLE[role] ?? [];
  const keep = (prefix: "s_" | "b") => Object.entries(filters).filter(([k, v]) => v && (prefix === "s_" ? !k.startsWith("s_") : k.startsWith("s_")));

  return (
    <>
      <PageHeader eyebrow="Reports" title="Reports & downloads"
        subtitle="Formatted Excel workbooks and PDF reports with the TRADEX letterhead. Choose filters, then download." />

      {buyerIds.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold text-ink">Buyer reports</h2>
          <Card className="mb-5 overflow-hidden">
            <BuyerFilters
              action={base}
              filters={filters}
              statuses={role === "DIC" ? ["BASIC_APPROVED", "APPROVED"] : ALL_STATUSES}
              itemStatuses={role === "DIC" ? DIC_VISIBLE_ITEMS : ALL_ITEM_STATUSES}
              countries={countries.map((c) => c.country)}
              sectors={sectors}
              actionLabel={role === "DIC" ? "Awaiting my approval" : "Needs FIEO action"}
              hidden={keep("b")}
            />
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            {buyerIds.map((id) => (
              <ReportCard key={id} id={id} href={`/api/reports/${id}${id === "mis-summary" || !bqs ? "" : `?${bqs}`}`}
                note={id === "mis-summary" ? "Always covers the whole programme (filters not applied)." : undefined} />
            ))}
          </div>
        </section>
      )}

      {sellerIds.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">Seller reports</h2>
          <Card className="mb-5 overflow-hidden">
            <form action={base} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              {keep("s_").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <Select name="s_status" defaultValue={filters.s_status ?? ""} aria-label="Seller status">
                <option value="">All seller statuses</option>
                {sellerStatuses.map((s) => <option key={s} value={s}>{SELLER_META[s].label}</option>)}
              </Select>
              {role !== "DISTRICT" ? (
                <Select name="s_district" defaultValue={filters.s_district ?? ""} aria-label="District">
                  <option value="">All districts</option>
                  {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
                </Select>
              ) : <div className="hidden lg:block" />}
              <Select name="s_sector" defaultValue={filters.s_sector ?? ""} aria-label="Sector">
                <option value="">All sectors</option>
                {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select name="s_exp" defaultValue={filters.s_exp ?? ""} aria-label="Export experience">
                <option value="">Any export experience</option>
                <option value="yes">Export experience: Yes</option>
                <option value="no">Export experience: No</option>
              </Select>
              <Button type="submit" variant="secondary">Apply</Button>
            </form>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            {sellerIds.map((id) => (
              <ReportCard key={id} id={id} href={`/api/reports/${id}${id === "seller-district-summary" || !sqs ? "" : `?${sqs}`}`}
                note={id === "seller-district-summary" ? "Covers all sellers you can see (filters not applied)." : undefined} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
