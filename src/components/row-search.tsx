"use client";

import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Filters the rows of a list or table already on the page: every element with a `data-search` attribute inside
 * `#{target}` stays visible only if it contains all the words typed (name, ID, district, contact, products…).
 */
export function RowSearch({ target, placeholder }: { target: string; placeholder: string }) {
  const [shown, setShown] = useState<{ n: number; of: number } | null>(null);
  const run = (q: string) => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = document.querySelectorAll<HTMLElement>(`#${target} [data-search]`);
    let n = 0;
    rows.forEach((r) => {
      const hit = words.every((w) => (r.dataset.search ?? "").includes(w));
      r.hidden = !hit;
      if (hit) n++;
    });
    setShown(words.length ? { n, of: rows.length } : null);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input type="search" onChange={(e) => run(e.target.value)} placeholder={placeholder} aria-label={placeholder}
          className="w-full rounded-lg border-0 py-2 pl-9 pr-3 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-600" />
      </div>
      {shown !== null && <span className="text-xs text-slate-500">{shown.n} of {shown.of} shown</span>}
    </div>
  );
}
