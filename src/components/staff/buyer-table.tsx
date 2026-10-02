import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import type { BuyerStatus, ItemStatus } from "@/generated/prisma/enums";
import { ItemChips } from "@/components/item-chips";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export type BuyerRow = {
  id: string; regNo: string; approvedNo: string | null; name: string; country: string; status: BuyerStatus;
  signupEmail: string; pocName: string | null; updatedAt: Date; createdAt: Date;
  user: { username: string };
  requirement: { items: { status: ItemStatus; sector: { name: string } }[] } | null;
};

export function BuyerTable({ rows, base }: { rows: BuyerRow[]; base: string }) {
  if (!rows.length) return <EmptyState icon={<Users className="size-5" />} title="No buyers found">Try changing the filters.</EmptyState>;
  return (
    <div className="table-scroll relative overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Reg. no.</th>
            <th className="px-4 py-3">Buyer</th>
            <th className="px-4 py-3">Country</th>
            <th className="px-4 py-3">Sectors</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            return (
              <tr key={r.id} className="group hover:bg-brand-50/40">
                <td className="px-4 py-3 align-top">
                  <div className="font-mono text-xs font-semibold text-ink">{r.regNo}</div>
                  {r.approvedNo && <div className="mt-0.5 font-mono text-[11px] font-semibold text-brand-700">{r.approvedNo}</div>}
                </td>
                <td className="px-4 py-3 align-top">
                  <Link href={`${base}/${r.id}`} className="font-semibold text-ink hover:text-brand-700">{r.name}</Link>
                  <div className="text-xs text-slate-500">{r.pocName ? `${r.pocName} · ` : ""}{r.signupEmail}</div>
                </td>
                <td className="px-4 py-3 align-top text-slate-700">{r.country}</td>
                <td className="max-w-64 px-4 py-3 align-top text-xs text-slate-600">
                  <ItemChips items={r.requirement?.items ?? []} />
                </td>
                <td className="px-4 py-3 align-top"><StatusBadge status={r.status} /></td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-500">{fmtDate(r.updatedAt)}</td>
                <td className="px-4 py-3 text-right align-top">
                  <Link href={`${base}/${r.id}`} aria-label={`Open ${r.name}`} className="inline-grid size-8 place-items-center rounded-lg text-slate-400 group-hover:bg-white group-hover:text-brand-700">
                    <ChevronRight className="size-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
