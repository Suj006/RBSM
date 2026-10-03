import Link from "next/link";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sellerScope } from "@/lib/seller-query";
import { ITEM_PENDING, SELLER_PENDING } from "@/lib/status";
import { Card, CardHeader } from "@/components/ui";
import { SectionBand } from "@/components/section-band";

/** Sector by sector: buyer requirements and sellers, approved and still pending — the live position for matchmaking. */
export async function SectorPosition({ user, base }: { user: User; base: string }) {
  const fieo = user.role === "FIEO"; // FIEO sees approved sellers only
  const [sectors, items, sellers] = await Promise.all([
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.requirementItem.groupBy({ by: ["sectorId", "status"], where: { status: { in: ["APPROVED", ...ITEM_PENDING] } }, _count: true }),
    prisma.sellerProduct.findMany({
      where: { seller: { AND: [sellerScope(user), { status: { in: ["APPROVED", ...SELLER_PENDING] } }] } },
      select: { sectorId: true, seller: { select: { status: true } } },
    }),
  ]);
  const rows = sectors.map((s) => {
    const it = items.filter((x) => x.sectorId === s.id);
    const sl = sellers.filter((x) => x.sectorId === s.id);
    return {
      ...s,
      bApproved: it.filter((x) => x.status === "APPROVED").reduce((n, x) => n + x._count, 0),
      bPending: it.filter((x) => x.status !== "APPROVED").reduce((n, x) => n + x._count, 0),
      sApproved: sl.filter((x) => x.seller.status === "APPROVED").length,
      sPending: sl.filter((x) => x.seller.status !== "APPROVED").length,
    };
  }).filter((r) => r.bApproved + r.bPending + r.sApproved + r.sPending > 0);
  const sum = (k: "bApproved" | "bPending" | "sApproved" | "sPending") => rows.reduce((n, r) => n + r[k], 0);
  const sellerHref = (sector: string, pending: boolean) =>
    fieo ? `${base}/seller-list?sector=${sector}` : `${base}/sellers?status=${pending ? "pending" : "APPROVED"}&sector=${sector}`;
  const num = (v: number, href: string, strong?: boolean) =>
    v ? <Link href={href} className={strong ? "font-bold text-ink hover:text-brand-700" : "text-slate-600 hover:text-brand-700"}>{v}</Link> : <span className="text-slate-300">0</span>;

  return (
    <section className="mt-10">
      <SectionBand id="sectors" kind="programme" title="Sector-wise position"
        summary="Buyer requirements and sellers in every sector, approved and still pending — live"
        links={[
          { href: `${base}/products`, label: "Product demand" },
          ...(fieo ? [] : [{ href: `${base}/insights`, label: "Insights →", primary: true }]),
        ]} />
      <Card>
        <CardHeader title="Approved and pending, by sector" subtitle={fieo ? "Sellers: approved only" : "Pending = still in verification (drafts and rejected not counted)"} />
        <div className="table-scroll relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th rowSpan={2} className="px-5 py-2.5 text-left align-bottom">Sector</th>
                <th colSpan={2} className="border-l border-slate-200 px-3 pt-2.5 text-center text-tx-blue">Buyer requirements</th>
                <th colSpan={fieo ? 1 : 2} className="border-l border-slate-200 px-3 pt-2.5 text-center text-brand-700">Sellers</th>
              </tr>
              <tr>
                <th className="border-l border-slate-200 px-3 py-2 text-right">Approved</th><th className="px-3 py-2 text-right">Pending</th>
                <th className="border-l border-slate-200 px-3 py-2 text-right">Approved</th>{!fieo && <th className="px-3 py-2 text-right">Pending</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 font-medium text-ink">{r.name}</td>
                  <td className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{num(r.bApproved, `${base}/requirements?item=APPROVED&sector=${r.id}`, true)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(r.bPending, `${base}/requirements?item=pending&sector=${r.id}`)}</td>
                  <td className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{num(r.sApproved, sellerHref(r.id, false), true)}</td>
                  {!fieo && <td className="px-3 py-2 text-right tabular-nums">{num(r.sPending, sellerHref(r.id, true))}</td>}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No sector data yet.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <tr>
                  <td className="px-5 py-2.5">Total</td>
                  <td className="border-l border-slate-200 px-3 py-2.5 text-right tabular-nums">{sum("bApproved")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{sum("bPending")}</td>
                  <td className="border-l border-slate-200 px-3 py-2.5 text-right tabular-nums">{sum("sApproved")}</td>
                  {!fieo && <td className="px-3 py-2.5 text-right tabular-nums">{sum("sPending")}</td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-slate-500">A seller offering several sectors is counted in each of them, so seller totals can exceed the number of sellers.</p>
      </Card>
    </section>
  );
}
