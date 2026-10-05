import { cn } from "@/lib/cn";

/** Horizontal bar list — used for country / sector breakdowns. */
export function BarList({ data, color = "bg-brand-500", empty = "No data yet." }: {
  data: { label: string; value: number; href?: string; icon?: React.ReactNode }[]; color?: string; empty?: string;
}) {
  if (!data.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700" title={d.label}>{d.icon}{d.href ? <a href={d.href} className="hover:text-brand-700 hover:underline">{d.label}</a> : d.label}</span>
            <span className="font-semibold tabular-nums text-ink">{d.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className={cn("h-2 rounded-full", color)} style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Daily column chart for the last N days. */
export function ColumnChart({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure>
      <div className="flex h-40 items-end gap-1.5" role="img" aria-label={`${label}: ${total} in the last ${data.length} days`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="rounded-t bg-tx-blue/80 transition group-hover:bg-tx-blue" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 4 : 0 }} />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">
              {d.day}: {d.value}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-[11px] text-slate-400">
        <span>{data[0]?.day}</span><span>{data[data.length - 1]?.day}</span>
      </figcaption>
    </figure>
  );
}

/** Stacked horizontal bar showing the pipeline split by status. */
export function PipelineBar({ segments }: { segments: { label: string; value: number; color: string; href?: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {total > 0 && segments.filter((s) => s.value).map((s) => (
          <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        {segments.map((s) => (
          <li key={s.label}>
            {(() => {
              const body = (
                <>
                  <span className={cn("size-2.5 shrink-0 rounded-sm", s.color)} />
                  <span className="truncate text-slate-600 group-hover:text-brand-700 group-hover:underline">{s.label}</span>
                  <span className="ml-auto font-semibold tabular-nums text-ink">{s.value}</span>
                </>
              );
              return s.href
                ? <a href={s.href} className="group -mx-1.5 flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-brand-50" title={`Open: ${s.label}`}>{body}</a>
                : <div className="flex items-center gap-2 py-0.5">{body}</div>;
            })()}
          </li>
        ))}
      </ul>
    </div>
  );
}
