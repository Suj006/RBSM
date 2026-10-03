import Link from "next/link";
import { ChevronDown, Package, Search } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { productDemand } from "@/lib/demand";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, StatCard } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";

export type ProductFilters = { q?: string; sector?: string; view?: string };

/** Product by product: what buyers want, from where, and which approved sellers can supply it. */
export async function ProductDemandPage({ user, root, filters }: { user: User; root: string; filters: ProductFilters }) {
  const [all, sectors] = await Promise.all([
    productDemand(user),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const q = filters.q?.trim().toLowerCase();
  const rows = all.filter((r) =>
    (!filters.sector || r.sectorId === filters.sector) &&
    (!q || r.product.toLowerCase().includes(q)) &&
    (filters.view === "gaps" ? r.sellers.length === 0 : filters.view === "approved" ? r.approvedBuyers > 0 : true));
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader eyebrow="Matchmaking" title="Product demand"
        subtitle="Every product international buyers have asked for: how many buyers want it, from which countries, and which approved Kerala sellers offer the same product."
        actions={<DownloadButtons href={`/api/reports/product-demand${qs ? `?${qs}` : ""}`} label="Product demand report" compact />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Products requested" value={all.length} accent="blue" hint="Distinct products, by sector" />
        <StatCard label="With approved buyer demand" value={all.filter((r) => r.approvedBuyers).length} accent="green" />
        <StatCard label="Supplied by approved sellers" value={all.filter((r) => r.sellers.length).length} accent="violet" hint="Same product offered in the same sector" />
        <StatCard label="Supply gaps" value={all.filter((r) => !r.sellers.length).length} accent="red" hint="No approved seller offers it yet" href={`${root}/products?view=gaps`} />
      </div>

      <Card className="overflow-hidden">
        <form action={`${root}/products`} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_1.2fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={filters.q} placeholder="Search product…" className="pl-9" aria-label="Search product" />
          </div>
          <Select name="sector" defaultValue={filters.sector ?? ""} aria-label="Sector">
            <option value="">All sectors</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select name="view" defaultValue={filters.view ?? ""} aria-label="Show">
            <option value="">All requested products</option>
            <option value="approved">With approved buyer demand</option>
            <option value="gaps">Supply gaps (no approved seller)</option>
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>

        {rows.length ? (
          <>
            <div className="hidden grid-cols-[1.6fr_1fr_1.2fr_0.9fr_24px] gap-4 bg-slate-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
              <span>Product · sector</span><span>Buyers</span><span>Countries</span><span>Approved sellers</span><span />
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.key}>
                  <details className="group">
                    <summary className="grid cursor-pointer list-none gap-2 px-5 py-3 hover:bg-slate-50 md:grid-cols-[1.6fr_1fr_1.2fr_0.9fr_24px] md:items-center md:gap-4 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{r.product}</div>
                        <div className="text-xs text-slate-500">{r.sectorName}</div>
                      </div>
                      <div className="text-sm">
                        <span className="font-bold text-ink">{r.approvedBuyers + r.pendingBuyers}</span>
                        <span className="text-slate-500"> · {r.approvedBuyers} approved{r.pendingBuyers ? `, ${r.pendingBuyers} pending` : ""}</span>
                      </div>
                      <div className="truncate text-sm text-slate-600" title={r.countries.join(", ")}>
                        {r.countries.slice(0, 3).join(", ")}{r.countries.length > 3 && <span className="text-slate-400"> +{r.countries.length - 3}</span>}
                      </div>
                      <div>{r.sellers.length ? <Badge tone="green">{r.sellers.length} seller{r.sellers.length > 1 ? "s" : ""}</Badge> : <Badge tone="red">No seller yet</Badge>}</div>
                      <ChevronDown className="hidden size-4 text-slate-400 transition group-open:rotate-180 md:block" />
                    </summary>
                    <div className="grid gap-6 bg-slate-50/60 px-5 pb-5 pt-2 md:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-tx-blue">Buyers asking for it</div>
                        <ul className="space-y-1.5 text-sm">
                          {r.buyers.map((b) => (
                            <li key={b.id} className="flex items-center justify-between gap-3">
                              <Link href={`${root}/buyers/${b.id}#item-${b.itemId}`} className="font-medium text-ink hover:text-brand-700">{b.name}</Link>
                              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">{b.country}
                                {b.approved ? <Badge tone="green">Approved</Badge> : <Badge tone="amber">Pending</Badge>}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-700">Approved sellers offering it</div>
                        {r.sellers.length ? (
                          <ul className="space-y-1.5 text-sm">
                            {r.sellers.map((s) => (
                              <li key={s.id} className="flex items-center justify-between gap-3">
                                <Link href={`${root}/sellers/${s.id}`} className="font-medium text-ink hover:text-brand-700">{s.name}</Link>
                                <span className="shrink-0 text-xs text-slate-500">{s.district}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-tx-red">No approved seller offers this product yet — a lead for the district centres to mobilise MSMEs.</p>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Products are matched by name within the same sector (e.g. “Cashew kernel” and “Cashew kernels” count as one). Click a product for the buyers and sellers.
            </p>
          </>
        ) : (
          <EmptyState icon={<Package className="size-5" />} title={all.length ? "No products match the filters" : "No buyer demand yet"}>
            {all.length ? "Try changing the filters." : "Products appear here once buyers submit their sector requirements."}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
