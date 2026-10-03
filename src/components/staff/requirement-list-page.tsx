import Link from "next/link";
import { ChevronRight, ClipboardList, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { ItemStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { itemScope, scopeFor } from "@/lib/buyer-query";
import { ALL_ITEM_STATUSES, DIC_ITEM_QUEUE, FIEO_ITEM_QUEUE, ITEM_META, ITEM_PENDING } from "@/lib/status";
import { fmtDate, parseCerts } from "@/lib/format";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { Pagination } from "./pagination";
import { DownloadButtons } from "./download-buttons";

export type ReqFilters = { q?: string; item?: string; sector?: string; country?: string; page?: string };
const PAGE_SIZE = 25;

/** One row per buyer sector requirement — the list behind every "sectors" tile. */
export async function RequirementListPage({ role, base, buyerBase, filters }: { role: Role; base: string; buyerBase: string; filters: ReqFilters }) {
  // Drafts are hidden unless asked for explicitly (the dashboard pipeline links to them).
  const and: Prisma.RequirementItemWhereInput[] = [itemScope(role), filters.item === "DRAFT" ? {} : { status: { not: "DRAFT" } }];
  if (filters.item === "action") and.push({ status: { in: role === "DIC" ? DIC_ITEM_QUEUE : FIEO_ITEM_QUEUE } });
  else if (filters.item === "with_fieo") and.push({ status: { in: FIEO_ITEM_QUEUE } });
  else if (filters.item === "pending") and.push({ status: { in: ITEM_PENDING } });
  else if (filters.item && ALL_ITEM_STATUSES.includes(filters.item as ItemStatus)) and.push({ status: filters.item as ItemStatus });
  if (filters.sector) and.push({ sectorId: filters.sector });
  if (filters.country) and.push({ requirement: { buyer: { country: filters.country } } });
  const q = filters.q?.trim();
  if (q) and.push({ OR: [{ products: { contains: q } }, { requirement: { buyer: { name: { contains: q } } } }, { requirement: { buyer: { regNo: { contains: q } } } }] });
  const where: Prisma.RequirementItemWhereInput = { AND: and };
  const page = Math.max(1, Number(filters.page) || 1);
  const statuses = ALL_ITEM_STATUSES;

  const [rows, total, sectors, countries] = await Promise.all([
    prisma.requirementItem.findMany({
      where, orderBy: [{ updatedAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { sector: true, requirement: { include: { buyer: { select: { id: true, name: true, regNo: true, approvedNo: true, country: true } } } } },
    }),
    prisma.requirementItem.count({ where }),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.buyer.findMany({ where: scopeFor(role), distinct: ["country"], select: { country: true }, orderBy: { country: "asc" } }),
  ]);
  const { page: _p, ...rest } = filters;
  void _p;
  const qs = new URLSearchParams(Object.entries({ item: filters.item === "action" || filters.item === "with_fieo" || filters.item === "pending" ? undefined : filters.item, sector: filters.sector, country: filters.country })
    .filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader title="Sector requirements"
        subtitle="Every buyer requirement, one row per sector — open a row to review it on the buyer's page."
        actions={<DownloadButtons href={`/api/reports/sector-requirements${qs ? `?${qs}` : ""}`} label="Sector-wise report" compact />} />
      <Card className="overflow-hidden">
        <form action={base} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={filters.q} placeholder="Search buyer, reg. no. or product…" className="pl-9" aria-label="Search" />
          </div>
          <Select name="item" defaultValue={filters.item ?? ""} aria-label="Status">
            <option value="">All statuses</option>
            <option value="action">{role === "ADMIN" ? "Pending with FIEO" : "⚑ Waiting for my decision"}</option>
            {role === "DIC" && <option value="with_fieo">Pending with FIEO</option>}
            <option value="pending">All pending (in verification)</option>
            {statuses.map((s) => <option key={s} value={s}>{ITEM_META[s].label}</option>)}
          </Select>
          <Select name="sector" defaultValue={filters.sector ?? ""} aria-label="Sector">
            <option value="">All sectors</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select name="country" defaultValue={filters.country ?? ""} aria-label="Country">
            <option value="">All countries</option>
            {countries.map((c) => <option key={c.country}>{c.country}</option>)}
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
        {rows.length ? (
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sector</th><th className="px-4 py-3">Buyer</th><th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Certifications</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const href = `${buyerBase}/${r.requirement.buyer.id}#item-${r.id}`;
                  const m = ITEM_META[r.status];
                  return (
                    <tr key={r.id} className="group align-top hover:bg-brand-50/40">
                      <td className="px-4 py-3 font-semibold text-ink">{r.sector.name}</td>
                      <td className="px-4 py-3">
                        <Link href={href} className="font-semibold text-ink hover:text-brand-700">{r.requirement.buyer.name}</Link>
                        <div className="text-xs text-slate-500">{r.requirement.buyer.country}</div>
                        <div className="whitespace-nowrap font-mono text-[11px] text-slate-500">{r.requirement.buyer.approvedNo ?? r.requirement.buyer.regNo}</div>
                      </td>
                      <td className="max-w-72 px-4 py-3 text-slate-700">{r.products}</td>
                      <td className="max-w-56 px-4 py-3 text-xs text-slate-600">{parseCerts(r.certifications).join(", ") || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={m.tone}>{m.short}</Badge>
                        {r.everApproved && r.status !== "APPROVED" && <div className="mt-1 text-[11px] font-medium text-sky-700">Modified after approval</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDate(r.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={href} aria-label={`Open ${r.requirement.buyer.name} — ${r.sector.name}`} className="inline-grid size-8 place-items-center rounded-lg text-slate-400 group-hover:bg-white group-hover:text-brand-700"><ChevronRight className="size-4" /></Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<ClipboardList className="size-5" />} title="No sector requirements found">Try changing the filters.</EmptyState>}
        <Pagination base={base} params={rest} page={page} total={total} pageSize={PAGE_SIZE} />
      </Card>
    </>
  );
}
