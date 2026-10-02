"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, UserRound, ClipboardList, Users, ShieldCheck, Layers, Award, Mail, FileDown, BadgeCheck, Inbox,
  Store, Upload, PlusCircle, Target, Boxes,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = {
  dashboard: LayoutDashboard, profile: UserRound, requirement: ClipboardList, buyers: Users, review: Inbox,
  approved: BadgeCheck, users: ShieldCheck, sectors: Layers, certs: Award, mail: Mail, reports: FileDown,
  sellers: Store, upload: Upload, add: PlusCircle, target: Target, demand: Boxes,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean; badge?: number };

export function NavLinks({ items, horizontal }: { items: NavItem[]; horizontal?: boolean }) {
  const path = usePathname();
  // Highlight only the most specific matching item (e.g. "Add seller" rather than also "Sellers").
  const matches = (it: NavItem) => (it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/"));
  const best = items.filter(matches).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <ul className={cn(horizontal ? "flex gap-1" : "space-y-1")}>
      {items.map((it) => {
        const active = it.href === best;
        const Icon = ICONS[it.icon];
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                horizontal && "whitespace-nowrap py-2",
                active ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-ink",
              )}
            >
              <Icon className={cn("size-4.5 shrink-0", active ? "text-brand-700" : "text-slate-400")} />
              <span className="flex-1">{it.label}</span>
              {!!it.badge && (
                <span className="rounded-full bg-tx-red px-2 py-0.5 text-[10px] font-bold text-white">{it.badge}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
