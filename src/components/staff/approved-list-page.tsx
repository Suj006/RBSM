import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { DownloadButtons } from "./download-buttons";

export async function ApprovedListPage({ base }: { base: string }) {
  const rows = await prisma.buyer.findMany({
    where: { status: "APPROVED" },
    orderBy: { approvedSeq: "asc" },
    include: { requirement: { select: { annualSourcingValue: true, items: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" }, select: { id: true, products: true, sector: { select: { name: true } } } } } } },
  });
  return (
    <>
      <PageHeader
        title="RBSM buyer list"
        subtitle={`${rows.length} buyers approved by the Directorate. Download for complete details — contacts, sourcing profile and every approved sector.`}
        actions={<DownloadButtons href="/api/reports/approved-buyers" label="Complete details" compact />}
      />
      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th><th className="px-4 py-3">Buyer no.</th><th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Country</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Approved sectors &amp; products</th><th className="px-4 py-3">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.id} className="align-top hover:bg-brand-50/40">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-brand-700">{r.approvedNo}</td>
                    <td className="px-4 py-3"><Link href={`${base}/buyers/${r.id}`} className="font-semibold text-ink hover:text-brand-700">{r.name}</Link>
                      <div className="font-mono text-[11px] text-slate-500">{r.regNo}</div></td>
                    <td className="px-4 py-3">{r.country}{r.requirement?.annualSourcingValue && <div className="text-xs text-slate-500">{r.requirement.annualSourcingValue}</div>}</td>
                    <td className="px-4 py-3 text-xs"><div className="font-medium text-ink">{r.pocName}</div><div className="text-slate-500">{r.pocDesignation}</div>
                      <div className="text-slate-500">{r.pocEmail}</div><div className="whitespace-nowrap text-slate-500">{r.pocMobile}</div></td>
                    <td className="max-w-md px-4 py-3 text-xs">
                      {r.requirement?.items.map((x) => (
                        <Link key={x.id} href={`${base}/buyers/${r.id}#item-${x.id}`} className="mb-1 block last:mb-0 hover:text-brand-700">
                          <span className="font-semibold text-ink">{x.sector.name}:</span> <span className="text-slate-600">{x.products}</span>
                        </Link>
                      ))}
                    </td>
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
