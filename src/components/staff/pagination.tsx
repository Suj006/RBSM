import Link from "next/link";

export function Pagination({ base, params, page, total, pageSize }: {
  base: string; params: Record<string, string | undefined>; page: number; total: number; pageSize: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${sp}`;
  };
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>{from}–{to} of {total}</span>
      <div className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50">Previous</Link>}
        {page < pages && <Link href={href(page + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50">Next</Link>}
      </div>
    </div>
  );
}
