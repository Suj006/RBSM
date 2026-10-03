"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  ["", "Overview"], ["/board", "Mapping board"], ["/preferences", "Seller preferences"],
  ["/checks", "Checks"], ["/results", "Results & gaps"], ["/published", "Published"],
] as const;

/** Section tabs shared by every matchmaking page. */
export function MatchTabs({ base }: { base: string }) {
  const path = usePathname();
  const active = (t: string) => (t ? path.startsWith(base + t) || (t === "/board" && path.startsWith(`${base}/buyers/`)) : path === base);
  return (
    <nav aria-label="Matchmaking" className="no-print -mx-1 mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-slate-200 px-1">
        {TABS.map(([t, label]) => (
          <li key={t}>
            <Link href={base + t} aria-current={active(t) ? "page" : undefined}
              className={cn("-mb-px inline-block border-b-2 px-3.5 py-2.5 text-sm font-semibold transition",
                active(t) ? "border-brand-600 text-brand-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-ink")}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
