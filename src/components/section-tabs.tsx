"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Section tabs under a base path ("" = the base page itself). */
export function SectionTabs({ base, tabs, label }: { base: string; tabs: readonly (readonly [string, string])[]; label: string }) {
  const path = usePathname();
  const active = (t: string) => (t ? path === base + t || path.startsWith(`${base}${t}/`) : path === base);
  return (
    <nav aria-label={label} className="no-print -mx-1 mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-slate-200 px-1">
        {tabs.map(([t, l]) => (
          <li key={t}>
            <Link href={base + t} aria-current={active(t) ? "page" : undefined}
              className={cn("-mb-px inline-block border-b-2 px-3.5 py-2.5 text-sm font-semibold transition",
                active(t) ? "border-brand-600 text-brand-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-ink")}>{l}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
