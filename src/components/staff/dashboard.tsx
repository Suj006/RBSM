import Link from "next/link";
import type { BuyerStatus, ItemStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { actionWhere, itemScope, scopeFor } from "@/lib/buyer-query";
import { DIC_ITEM_QUEUE, FIEO_ITEM_QUEUE, ITEM_META, ROLE_LABEL } from "@/lib/status";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { SectionBand, SectionJumps } from "@/components/section-band";
import { BarList, ColumnChart, PipelineBar } from "@/components/charts";
import { StatusBadge } from "@/components/status-badge";
import { ItemChips } from "@/components/item-chips";
import { fmtDate } from "@/lib/format";
import { EVENT } from "@/lib/config";

const DAYS = 14;

export async function StaffDashboard({ role, base }: { role: Role; base: string }) {
  const scope = scopeFor(role);
  const iScope = itemScope(role);
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (DAYS - 1));
  const itemQueue: ItemStatus[] = role === "DIC" ? DIC_ITEM_QUEUE : FIEO_ITEM_QUEUE;

  const [byStatus, byItem, byCountry, sectorItems, recent, queue] = await Promise.all([
    prisma.buyer.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.requirementItem.groupBy({ by: ["status"], where: iScope, _count: true }),
    prisma.buyer.groupBy({ by: ["country"], where: scope, _count: true, orderBy: { _count: { country: "desc" } }, take: 8 }),
    // Sectors of interest: approved requirements only.
    prisma.requirementItem.findMany({ where: { AND: [iScope, { status: "APPROVED" }] }, select: { sectorId: true, sector: { select: { name: true } } } }),
    prisma.buyer.findMany({ where: { AND: [scope, { createdAt: { gte: since } }] }, select: { createdAt: true } }),
    prisma.buyer.findMany({
      where: { AND: [scope, actionWhere(role)] },
      orderBy: { updatedAt: "asc" },
      take: 6,
      include: { requirement: { select: { items: { where: { status: { in: itemQueue } }, select: { status: true, sector: { select: { name: true } } } } } } },
    }),
  ]);
  const count = (...s: BuyerStatus[]) => byStatus.filter((x) => s.includes(x.status)).reduce((n, x) => n + x._count, 0);
  const items = (...s: ItemStatus[]) => byItem.filter((x) => s.includes(x.status)).reduce((n, x) => n + x._count, 0);
  const total = byStatus.reduce((n, x) => n + x._count, 0);
  const totalItems = byItem.reduce((n, x) => n + x._count, 0);

  const sectorCounts = new Map<string, { name: string; id: string; n: number }>();
  for (const it of sectorItems) {
    const e = sectorCounts.get(it.sectorId) ?? { name: it.sector.name, id: it.sectorId, n: 0 };
    e.n++; sectorCounts.set(it.sectorId, e);
  }
  const topSectors = [...sectorCounts.values()].sort((a, b) => b.n - a.n).slice(0, 8);

  const days = Array.from({ length: DAYS }, (_, i) => { const d = new Date(since); d.setDate(since.getDate() + i); return d; });
  const trend = days.map((d) => ({
    day: fmtDate(d).slice(0, 6),
    value: recent.filter((r) => r.createdAt.toDateString() === d.toDateString()).length,
  }));

  // Every staff role sees the whole programme; the Directorate's own queue is highlighted in row 2.
  const stats = [
        // Row 1 — basic details
        { label: "Total sign-ups", value: total, accent: "blue" as const, href: `${base}/buyers` },
        { label: "Basic details not submitted / returned", value: count("SIGNED_UP", "BASIC_RETURNED"), accent: "slate" as const,
          hint: count("BASIC_RETURNED") ? `${count("BASIC_RETURNED")} returned for correction` : undefined, href: `${base}/buyers?status=basic_pending` },
        { label: "Basic details to verify", value: count("BASIC_SUBMITTED"), accent: "yellow" as const, href: `${base}/buyers?status=BASIC_SUBMITTED` },
        { label: "Basic details approved", value: count("BASIC_APPROVED", "APPROVED"), accent: "green" as const,
          hint: `${count("APPROVED")} already approved buyers`, href: `${base}/buyers?status=basic_approved` },
        // Row 2 — sector requirements
        { label: "Sectors pending with FIEO", value: items(...FIEO_ITEM_QUEUE), accent: "yellow" as const, hint: items("DIC_RETURNED") ? `${items("DIC_RETURNED")} returned by Directorate` : undefined,
          href: `${base}/requirements?item=${role === "DIC" ? "with_fieo" : "action"}` },
        { label: role === "DIC" ? "Sectors awaiting my approval" : "Sectors with Directorate", value: items("FIEO_RECOMMENDED"), accent: "violet" as const, href: `${base}/requirements?item=FIEO_RECOMMENDED` },
        { label: "Approved sectors", value: items("APPROVED"), accent: "green" as const, href: `${base}/requirements?item=APPROVED` },
        { label: "Approved buyers", value: count("APPROVED"), accent: "green" as const, href: `${base}/buyers?status=APPROVED` },
      ];

  const buyerPipeline = [
    { label: "Basic details pending", value: count("SIGNED_UP", "BASIC_RETURNED"), color: "bg-slate-400", href: `${base}/buyers?status=basic_pending` },
    { label: "Basic under review", value: count("BASIC_SUBMITTED"), color: "bg-tx-yellow", href: `${base}/buyers?status=BASIC_SUBMITTED` },
    { label: "Requirement stage", value: count("BASIC_APPROVED"), color: "bg-tx-blue", href: `${base}/buyers?status=BASIC_APPROVED` },
    { label: "Approved buyers", value: count("APPROVED"), color: "bg-tx-green", href: `${base}/buyers?status=APPROVED` },
  ];
  const itemPipeline = (Object.keys(ITEM_META) as ItemStatus[]).map((s) => ({
    label: ITEM_META[s].short, value: items(s), color: ITEM_META[s].dot, href: `${base}/requirements?item=${s}`,
  }));

  return (
    <>
      <PageHeader eyebrow={`${ROLE_LABEL[role]} · ${EVENT.name} ${EVENT.short}`} title="Dashboard"
        subtitle="Real-time view of the whole programme — international buyers first, then Kerala MSME sellers."
        actions={<SectionJumps />} />

      <SectionBand id="buyers" kind="buyers" title="Buyer registration & sector approvals"
        summary={`${total} buyers registered · ${count("APPROVED")} approved · ${totalItems} sector requirements`}
        links={[
          { href: `${base}/buyers`, label: "All buyers" },
          ...(role === "ADMIN" ? [] : [{ href: `${base}/buyers?status=action`, label: "Buyer work queue →", primary: true }]),
        ]} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Buyer pipeline" subtitle={`${total} buyers · ${totalItems} sector requirements in view`} />
          <div className="space-y-8 p-6">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Buyers</div>
              <PipelineBar segments={buyerPipeline} />
            </div>
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Sector requirements</div>
              <PipelineBar segments={itemPipeline} />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="New sign-ups" subtitle={`Last ${DAYS} days`} />
          <div className="p-6 pt-8"><ColumnChart data={trend} label="Sign-ups" /></div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Work queue" subtitle="Oldest first" action={<Link href={`${base}/buyers?status=action`} className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>} />
          <ul className="divide-y divide-slate-100">
            {queue.map((b) => (
              <li key={b.id}>
                <Link href={`${base}/buyers/${b.id}`} className="block px-5 py-3 hover:bg-slate-50">
                  <div className="truncate text-sm font-semibold text-ink" title={b.name}>{b.name}</div>
                  <div className="text-xs text-slate-500">{b.regNo} · {b.country} · {fmtDate(b.updatedAt)}</div>
                  {b.status === "BASIC_SUBMITTED" && <div className="mt-1.5"><StatusBadge status={b.status} /></div>}
                  {!!b.requirement?.items.length && <div className="mt-1.5"><ItemChips items={b.requirement.items} /></div>}
                </Link>
              </li>
            ))}
            {!queue.length && <li className="px-5 py-8 text-center text-sm text-slate-500">Nothing waiting — all caught up.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Top countries" />
          <div className="p-6">
            <BarList data={byCountry.map((c) => ({ label: c.country, value: c._count, href: `${base}/buyers?country=${encodeURIComponent(c.country)}` }))} color="bg-tx-green" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Sectors of interest" subtitle="Approved buyer requirements per sector" />
          <div className="p-6">
            <BarList data={topSectors.map((s) => ({ label: s.name, value: s.n, href: `${base}/requirements?item=APPROVED&sector=${s.id}` }))} color="bg-tx-red" empty="No approved sector requirements yet." />
          </div>
        </Card>
      </div>
    </>
  );
}
