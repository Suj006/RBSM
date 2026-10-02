import Link from "next/link";
import { LogOut, KeyRound } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Logo } from "@/components/logo";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_BADGE } from "@/lib/status";
import { NavLinks, type NavItem } from "./nav-links";

export function AppShell({ role, user, nav, children }: {
  role: Role;
  user: { displayName: string; username: string };
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="tx-ribbon h-1" />
        <Link href="/" className="px-5 py-5"><Logo /></Link>
        <div className="px-5 pb-3">
          <span className="rounded-md bg-ink px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">{ROLE_BADGE[role]}</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4"><NavLinks items={nav} /></nav>
        <div className="border-t border-slate-200 p-4">
          <div className="truncate text-sm font-semibold text-ink" title={user.displayName}>{user.displayName}</div>
          <div className="truncate font-mono text-xs text-slate-500">{user.username}</div>
          <div className="mt-3 flex gap-2">
            <Link href="/change-password" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
              <KeyRound className="size-3.5" /> Password
            </Link>
            <form action={logoutAction} className="flex-1">
              <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-tx-red ring-1 ring-red-100 hover:bg-red-50">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile header */}
        <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="tx-ribbon h-1" />
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/"><Logo withText={false} /></Link>
            <form action={logoutAction}>
              <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-tx-red ring-1 ring-red-100">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </form>
          </div>
          <nav className="overflow-x-auto px-2 pb-2"><NavLinks items={nav} horizontal /></nav>
        </header>
        <main className="print-full mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
