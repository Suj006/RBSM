import Link from "next/link";
import { BadgeCheck, FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { fmtDate } from "@/lib/format";

export async function ApprovedListPage({ base }: { base: string }) {
  const rows = await prisma.buyer.findMany({
    where: { status: "APPROVED" },
    orderBy: { approvedSeq: "asc" },
    include: { requirement: { select: { items: { select: { sector: { select: { name: true } } } } } } },
  });
  return (
    <>
      <PageHeader
        title="RBSM buyer list"
        subtitle={`${rows.length} buyers approved by the Directorate.`}
        actions={<>
          <a href="/api/export/buyers?status=APPROVED" className="no-print inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
            <FileSpreadsheet className="size-4 text-brand-700" /> Download (Excel/CSV)
          </a>
          <PrintButton />
        </>}
      />
      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th><th className="px-4 py-3">Buyer no.</th><th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Country</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Sectors</th><th className="px-4 py-3">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-brand-700">{r.approvedNo}</td>
                    <td className="px-4 py-3"><Link href={`${base}/buyers/${r.id}`} className="font-semibold text-ink hover:text-brand-700">{r.name}</Link>
                      <div className="font-mono text-[11px] text-slate-500">{r.regNo}</div></td>
                    <td className="px-4 py-3">{r.country}</td>
                    <td className="px-4 py-3 text-xs">{r.pocName}<div className="text-slate-500">{r.pocEmail} · {r.pocMobile}</div></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.requirement?.items.map((x) => x.sector.name).join(", ")}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDate(r.approvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<BadgeCheck className="size-5" />} title="No approved buyers yet">Buyers appear here once the Directorate approves them.</EmptyState>
        )}
      </Card>
    </>
  );
}
