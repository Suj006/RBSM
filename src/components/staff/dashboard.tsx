import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BuyerStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { scopeFor } from "@/lib/buyer-query";
import { FIEO_ACTIONABLE, ROLE_LABEL } from "@/lib/status";
import { Card, CardHeader, PageHeader, StatCard, ButtonLink } from "@/components/ui";
import { BarList, ColumnChart, PipelineBar } from "@/components/charts";
import { StatusBadge } from "@/components/status-badge";
import { fmtDate } from "@/lib/format";
import { EVENT } from "@/lib/config";

const DAYS = 14;

export async function StaffDashboard({ role, base }: { role: Role; base: string }) {
  const scope = scopeFor(role);
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (DAYS - 1));
  const actionable: BuyerStatus[] = role === "DIC" ? ["FIEO_RECOMMENDED"] : FIEO_ACTIONABLE;

  const [byStatus, byCountry, sectorItems, recent, queue] = await Promise.all([
    prisma.buyer.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.buyer.groupBy({ by: ["country"], where: scope, _count: true, orderBy: { _count: { country: "desc" } }, take: 8 }),
    prisma.requirementItem.findMany({ where: { requirement: { buyer: scope } }, select: { sectorId: true, sector: { select: { name: true } } } }),
    prisma.buyer.findMany({ where: { AND: [scope, { createdAt: { gte: since } }] }, select: { createdAt: true } }),
    prisma.buyer.findMany({ where: { AND: [scope, { status: { in: actionable } }] }, orderBy: { updatedAt: "asc" }, take: 6 }),
  ]);
  const count = (...s: BuyerStatus[]) => byStatus.filter((x) => s.includes(x.status)).reduce((n, x) => n + x._count, 0);
  const total = byStatus.reduce((n, x) => n + x._count, 0);

  const sectorCounts = new Map<string, { name: string; id: string; n: number }>();
  for (const it of sectorItems) {
    const e = sectorCounts.get(it.sectorId) ?? { name: it.sector.name, id: it.sectorId, n: 0 };
    e.n++; sectorCounts.set(it.sectorId, e);
  }
  const topSectors = [...sectorCounts.values()].sort((a, b) => b.n - a.n).slice(0, 8);

  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since); d.setDate(since.getDate() + i);
    return d;
  });
  const trend = days.map((d) => ({
    day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    value: recent.filter((r) => r.createdAt.toDateString() === d.toDateString()).length,
  }));

  const stats = role === "DIC"
    ? [
        { label: "Awaiting my approval", value: count("FIEO_RECOMMENDED"), accent: "violet" as const, href: `${base}/buyers?status=FIEO_RECOMMENDED` },
        { label: "Returned to FIEO", value: count("DIC_RETURNED"), accent: "red" as const, href: `${base}/buyers?status=DIC_RETURNED` },
        { label: "Approved buyers", value: count("APPROVED"), accent: "green" as const, href: `${base}/approved` },
        { label: "Countries represented", value: byCountry.length, accent: "blue" as const },
      ]
    : [
        { label: "Total sign-ups", value: total, accent: "blue" as const, href: `${base}/buyers` },
        { label: "Pending FIEO action", value: count(...FIEO_ACTIONABLE), accent: "yellow" as const, href: `${base}/buyers?status=action` },
        { label: "With Directorate", value: count("FIEO_RECOMMENDED"), accent: "violet" as const, href: `${base}/buyers?status=FIEO_RECOMMENDED` },
        { label: "Approved buyers", value: count("APPROVED"), accent: "green" as const, href: `${base}/buyers?status=APPROVED` },
      ];

  const pipeline = role === "DIC"
    ? [
        { label: "Awaiting DIC", value: count("FIEO_RECOMMENDED"), color: "bg-violet-500" },
        { label: "Returned to FIEO", value: count("DIC_RETURNED"), color: "bg-tx-red" },
        { label: "Approved", value: count("APPROVED"), color: "bg-tx-green" },
      ]
    : [
        { label: "Basic details pending", value: count("SIGNED_UP", "BASIC_RETURNED"), color: "bg-slate-400" },
        { label: "Basic under review", value: count("BASIC_SUBMITTED"), color: "bg-tx-yellow" },
        { label: "Requirement pending", value: count("BASIC_APPROVED", "REQ_RETURNED"), color: "bg-tx-blue" },
        { label: "Requirement under review", value: count("REQ_SUBMITTED", "DIC_RETURNED"), color: "bg-amber-500" },
        { label: "With Directorate", value: count("FIEO_RECOMMENDED"), color: "bg-violet-500" },
        { label: "Approved", value: count("APPROVED"), color: "bg-tx-green" },
      ];

  return (
    <>
      <PageHeader eyebrow={`${ROLE_LABEL[role]} · ${EVENT.name} ${EVENT.short}`} title="Dashboard"
        subtitle="Real-time view of buyer registrations and verification progress."
        actions={<ButtonLink href={`${base}/buyers?status=action`}>Open work queue <ArrowRight className="size-4" /></ButtonLink>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Registration pipeline" subtitle={`${total} buyers in view`} />
          <div className="p-6"><PipelineBar segments={pipeline} /></div>
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
                <Link href={`${base}/buyers/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{b.name}</div>
                    <div className="text-xs text-slate-500">{b.regNo} · {b.country} · {fmtDate(b.updatedAt)}</div>
                  </div>
                  <StatusBadge status={b.status} />
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
          <CardHeader title="Sectors of interest" subtitle="From detailed requirements" />
          <div className="p-6">
            <BarList data={topSectors.map((s) => ({ label: s.name, value: s.n, href: `${base}/buyers?sector=${s.id}` }))} color="bg-tx-red" empty="No requirements submitted yet." />
          </div>
        </Card>
      </div>
    </>
  );
}
