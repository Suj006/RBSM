import Link from "next/link";
import { Target } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import type { SellerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { sellerScope } from "@/lib/seller-query";
import { DISTRICT_NAMES } from "@/lib/config";
import { getTargets } from "@/lib/targets";
import { SELLER_META } from "@/lib/status";
import { fmtDate } from "@/lib/format";
import { Badge, Card, CardHeader, StatCard } from "@/components/ui";
import { BarList, PipelineBar } from "@/components/charts";
import { cn } from "@/lib/cn";

function Progress({ label, value, target, color, suffix }: { label: string; value: number; target: number; color: string; suffix?: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-sm tabular-nums text-slate-600"><span className="text-lg font-extrabold text-ink">{value}</span> / {target}{suffix}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100"><div className={cn("h-2.5 rounded-full", color)} style={{ width: `${Math.max(pct, value ? 2 : 0)}%` }} /></div>
      <div className="mt-1 text-xs text-slate-500">{pct.toFixed(0)}% of target</div>
    </div>
  );
}

/** Seller statistics for any staff role, within what that role may see. */
export async function SellerOverview({ user, base, standalone }: { user: User; base: string; standalone?: boolean }) {
  const scope = sellerScope(user);
  const [byStatus, byDistrict, products, exp, bySource, approvedBuyers, recent] = await Promise.all([
    prisma.seller.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.seller.groupBy({ by: ["district", "status"], where: scope, _count: true }),
    prisma.sellerProduct.findMany({ where: { seller: scope }, select: { sectorId: true, sector: { select: { name: true } } } }),
    prisma.seller.groupBy({ by: ["exportExperience", "status"], where: scope, _count: true }),
    prisma.seller.groupBy({ by: ["source"], where: scope, _count: true }),
    prisma.buyer.count({ where: { status: "APPROVED" } }),
    user.role === "DISTRICT" || user.role === "DIC"
      ? prisma.seller.findMany({
          where: { AND: [scope, { status: { in: user.role === "DISTRICT" ? ["WITH_DISTRICT", "RETURNED"] : ["RECOMMENDED"] } }] },
          orderBy: { updatedAt: "asc" }, take: 6,
        })
      : Promise.resolve([]),
  ]);
  const n = (...s: SellerStatus[]) => byStatus.filter((x) => s.includes(x.status)).reduce((a, x) => a + x._count, 0);
  const total = byStatus.reduce((a, x) => a + x._count, 0);
  const approved = n("APPROVED");
  const expCount = (yes: boolean, status?: SellerStatus) =>
    exp.filter((e) => e.exportExperience === yes && (!status || e.status === status)).reduce((a, e) => a + e._count, 0);

  const stats =
    user.role === "DISTRICT" ? [
      { label: "Sellers registered", value: total, accent: "blue" as const, href: `${base}/sellers` },
      { label: "Pending my recommendation", value: n("WITH_DISTRICT", "RETURNED"), accent: "yellow" as const, hint: [n("RETURNED") && `${n("RETURNED")} returned by Directorate`, n("WITH_SELLER") && `${n("WITH_SELLER")} with applicants for correction`].filter(Boolean).join(" · ") || undefined, href: `${base}/sellers?status=action` },
      { label: "With Directorate", value: n("RECOMMENDED"), accent: "violet" as const, href: `${base}/sellers?status=RECOMMENDED` },
      { label: "Approved sellers", value: approved, accent: "green" as const, href: `${base}/sellers?status=APPROVED` },
    ]
    : user.role === "FIEO" ? [
      { label: "Approved sellers", value: approved, accent: "green" as const, href: `${base}/sellers` },
      { label: "With export experience", value: expCount(true), accent: "blue" as const, href: `${base}/sellers?exp=yes` },
      { label: "Sectors covered", value: new Set(products.map((p) => p.sectorId)).size, accent: "violet" as const },
      { label: "Districts represented", value: new Set(byDistrict.map((d) => d.district)).size, accent: "yellow" as const },
    ]
    : [
      { label: "Sellers awaiting approval", value: n("RECOMMENDED"), accent: "violet" as const, href: `${base}/sellers?status=RECOMMENDED` },
      { label: "Returned to districts", value: n("RETURNED"), accent: "red" as const, href: `${base}/sellers?status=RETURNED` },
      { label: "Approved sellers", value: approved, accent: "green" as const, href: `${base}/sellers?status=APPROVED` },
      ...(user.role === "ADMIN"
        ? [{ label: "Pending with districts", value: n("WITH_DISTRICT"), accent: "yellow" as const, href: `${base}/sellers?status=WITH_DISTRICT` }]
        : [{ label: "Approved, with export experience", value: expCount(true, "APPROVED"), accent: "blue" as const, href: `${base}/sellers?status=APPROVED&exp=yes` }]),
    ];

  const sectorCounts = new Map<string, { id: string; name: string; n: number }>();
  for (const p of products) {
    const e = sectorCounts.get(p.sectorId) ?? { id: p.sectorId, name: p.sector.name, n: 0 };
    e.n++; sectorCounts.set(p.sectorId, e);
  }
  const topSectors = [...sectorCounts.values()].sort((a, b) => b.n - a.n).slice(0, 10);
  const statuses = (Object.keys(SELLER_META) as SellerStatus[]).filter((s) => user.role === "DISTRICT" || user.role === "ADMIN" || byStatus.some((x) => x.status === s));
  const districtRows = DISTRICT_NAMES.map((d) => {
    const c = (...s: SellerStatus[]) => byDistrict.filter((x) => x.district === d && s.includes(x.status)).reduce((a, x) => a + x._count, 0);
    return { d, pending: c("WITH_DISTRICT"), dic: c("RECOMMENDED"), returned: c("RETURNED"), approved: c("APPROVED") };
  });
  const targets = await getTargets();
  const ownTarget = user.role === "DISTRICT" ? targets.district[user.district ?? ""] ?? 0 : 0;

  const sellersBySector = (
    <Card className={user.role === "ADMIN" ? "" : "lg:col-span-2"}>
      <CardHeader title="Sellers by sector" subtitle="Sellers ready to export, per sector" />
      <div className="p-6">
        <BarList data={topSectors.map((s) => ({ label: s.name, value: s.n, href: `${base}/sellers?sector=${s.id}` }))} color="bg-tx-red" empty="No sellers yet." />
      </div>
    </Card>
  );

  return (
    <section className={standalone ? "" : "mt-10"}>
      {!standalone && (
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">Sellers (MSMEs)</div>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">Seller registration</h2>
          </div>
          <Link href={`${base}/sellers`} className="text-sm font-semibold text-brand-700 hover:underline">All sellers →</Link>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        {/* FIEO sees approved sellers only, so a status pipeline would be a single bar. */}
        {user.role === "FIEO" ? sellersBySector : <Card className="lg:col-span-2">
          <CardHeader title="Seller pipeline" subtitle={`${total} sellers in view`} />
          <div className="space-y-6 p-6">
            <PipelineBar segments={statuses.map((s) => ({ label: SELLER_META[s].short, value: n(s), color: SELLER_META[s].dot, href: `${base}/sellers?status=${s}` }))} />
            {(user.role === "DISTRICT" || user.role === "ADMIN" || user.role === "DIC") && (
              <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">How sellers were registered</div>
                  <ul className="space-y-1 text-sm">
                    {[["DISTRICT", "Entered by district centre"], ["BULK", "Bulk upload"], ["SELF", "Self-registered"]].map(([k, l]) => (
                      <li key={k} className="flex justify-between"><span className="text-slate-600">{l}</span><span className="font-semibold tabular-nums">{bySource.find((x) => x.source === k)?._count ?? 0}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Export experience</div>
                  <ul className="space-y-1 text-sm">
                    <li className="flex justify-between"><span className="text-slate-600">Yes</span><span className="font-semibold tabular-nums">{expCount(true)}</span></li>
                    <li className="flex justify-between"><span className="text-slate-600">No</span><span className="font-semibold tabular-nums">{expCount(false)}</span></li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </Card>}
        <Card>
          <CardHeader title="Programme targets" icon={<Target className="size-4" />}
            subtitle={user.role === "DISTRICT" ? "Approved-seller target set by the Directorate" : `Each buyer to meet at least ${targets.sellersPerBuyer} sellers`}
            action={user.role === "DIC" || user.role === "ADMIN" ? <Link href={`${base}/targets`} className="text-sm font-semibold text-brand-700 hover:underline">Edit</Link> : undefined} />
          <div className="space-y-6 p-6">
            {user.role === "DISTRICT" ? (
              <Progress label={`Approved sellers — ${user.district}`} value={approved} target={ownTarget} color="bg-tx-green" />
            ) : (
              <>
                <Progress label="Approved sellers" value={approved} target={targets.sellers} color="bg-tx-green" />
                <Progress label="Approved buyers" value={approvedBuyers} target={targets.buyers} color="bg-tx-blue" />
                <Progress label="Sellers per approved buyer" value={approvedBuyers ? Math.floor(approved / approvedBuyers) : 0} target={targets.sellersPerBuyer} color="bg-tx-yellow" />
              </>
            )}
          </div>
        </Card>
      </div>

      {user.role !== "FIEO" && <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {user.role === "DISTRICT" || user.role === "DIC" ? (
          <Card>
            <CardHeader title={user.role === "DISTRICT" ? "Waiting for recommendation" : "Waiting for approval"} subtitle="Oldest first"
              action={<Link href={`${base}/sellers?status=action`} className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>} />
            <ul className="divide-y divide-slate-100">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link href={`${base}/sellers/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.regNo} · {s.district} · {fmtDate(s.updatedAt)}</div>
                    </div>
                    {s.status === "RETURNED" && <Badge tone="red">Returned</Badge>}
                  </Link>
                </li>
              ))}
              {!recent.length && <li className="px-5 py-8 text-center text-sm text-slate-500">Nothing waiting — all caught up.</li>}
            </ul>
          </Card>
        ) : null}
        {sellersBySector}
        {(user.role === "DIC" || user.role === "ADMIN") && (
          <Card className={user.role === "DIC" ? "lg:col-span-3" : "lg:col-span-2"}>
            <CardHeader title="District-wise position" subtitle="Approved sellers against each district's target" />
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">District</th>
                    {user.role === "ADMIN" && <th className="px-3 py-2.5 text-right">With district</th>}
                    <th className="px-3 py-2.5 text-right">With Directorate</th>
                    <th className="px-3 py-2.5 text-right">Returned</th>
                    <th className="px-3 py-2.5 text-right">Approved</th>
                    <th className="w-[28%] px-4 py-2.5 text-left">Progress to target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {districtRows.map((r) => {
                    const tg = targets.district[r.d] ?? 0;
                    const pct = tg ? Math.min(100, (r.approved / tg) * 100) : 0;
                    return (
                      <tr key={r.d} className="hover:bg-slate-50">
                        <td className="px-4 py-2"><Link href={`${base}/sellers?district=${encodeURIComponent(r.d)}`} className="hover:text-brand-700">{r.d}</Link></td>
                        {user.role === "ADMIN" && <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.pending}</td>}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.dic}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.returned}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{r.approved}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-tx-green" style={{ width: `${Math.max(pct, r.approved ? 3 : 0)}%` }} /></div>
                            <span className="w-16 text-right text-xs tabular-nums text-slate-500">{r.approved}/{tg}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>}
    </section>
  );
}
