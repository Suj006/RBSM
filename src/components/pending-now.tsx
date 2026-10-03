import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

export type PendingRow = { label: string; value: number; href: string; dot: string; group?: string };

/** Live count of everything still in progress, by stage — each count opens the matching list. */
export function PendingNow({ title, rows, className }: { title: string; rows: PendingRow[]; className?: string }) {
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={`${total} pending · live position by stage`} icon={<Clock className="size-4" />} />
      <ul className="px-3 py-2">
        {rows.map((r, i) => (
          <li key={r.label}>
            {r.group && r.group !== rows[i - 1]?.group && (
              <div className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{r.group}</div>
            )}
            <Link href={r.href} className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
              <span className={cn("size-2.5 shrink-0 rounded-full", r.dot)} />
              <span className="flex-1 text-slate-700 group-hover:text-brand-700">{r.label}</span>
              <span className={cn("min-w-8 text-right font-bold tabular-nums", r.value ? "text-ink" : "text-slate-300")}>{r.value}</span>
              <ChevronRight className="size-4 text-slate-300 group-hover:text-brand-700" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
