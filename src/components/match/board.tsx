import Link from "next/link";
import { AlertTriangle, ChevronRight, Search } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { loadBoard, matchChecks } from "@/lib/matchmaking";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { cn } from "@/lib/cn";

export type BoardFilters = { q?: string; show?: string };

/** Every approved buyer with the sellers mapped so far (working list). */
export async function MatchBoard({ user, base, filters }: { user: User; base: string; filters: BoardFilters }) {
  const board = await loadBoard();
  const issues = await matchChecks(board);
  const { rows, pool, state } = board;
  const q = filters.q?.trim().toLowerCase();
  const list = rows.filter((r) =>
    (!q || r.buyer.name.toLowerCase().includes(q) || r.buyer.country.toLowerCase().includes(q) || (r.buyer.approvedNo ?? "").toLowerCase().includes(q)) &&
    (filters.show === "below" ? r.matches.length < pool.target : filters.show === "issues" ? issues.some((i) => i.buyerId === r.buyer.id) : true));

  return (
    <>
      <PageHeader back={{ href: base, label: "Back to matchmaking" }} eyebrow="Matchmaking" title="Mapping board"
        subtitle={`Working list: ${rows.reduce((n, r) => n + r.matches.length, 0)} pairs across ${rows.length} approved buyers. Target ${pool.target} sellers per buyer. Open a buyer to add or remove sellers.`}
        actions={<DownloadButtons href="/api/reports/match-list?v=draft" label="Working list" compact />} />
      {!state.prefsFrozen && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Seller preferences are still open. The mapping can be built and edited once they are frozen{user.role === "DIC" ? " (Matchmaking → Freeze preferences)" : ""}.
        </p>
      )}
      <Card className="overflow-hidden">
        <form action={`${base}/board`} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[1.5fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={filters.q} placeholder="Search buyer, buyer no. or country…" className="pl-9" aria-label="Search" />
          </div>
          <Select name="show" defaultValue={filters.show ?? ""} aria-label="Show">
            <option value="">All approved buyers</option>
            <option value="below">Below target</option>
            <option value="issues">With items to review</option>
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
        <div className="table-scroll relative overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Buyer</th><th className="px-3 py-2.5 text-left">Approved sectors</th>
                <th className="w-52 px-3 py-2.5 text-left">Sellers mapped</th>
                <th className="px-3 py-2.5 text-right">Preference</th><th className="px-3 py-2.5 text-right">System</th><th className="px-3 py-2.5 text-right">Manual</th>
                <th className="px-3 py-2.5 text-right">Preferred by</th><th className="px-3 py-2.5 text-left">Review</th><th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => {
                const n = r.matches.length;
                const pct = Math.min(100, (n / Math.max(1, pool.target)) * 100);
                const src = (s: string) => r.matches.filter((m) => m.source === s).length;
                const iss = issues.filter((i) => i.buyerId === r.buyer.id);
                const unpublished = state.version > 0 && r.matches.some((m) => !m.inPublished);
                return (
                  <tr key={r.buyer.id} className="group hover:bg-brand-50/40">
                    <td className="px-4 py-2.5">
                      <Link href={`${base}/buyers/${r.buyer.id}`} className="font-semibold text-ink hover:text-brand-700">{r.buyer.name}</Link>
                      <div className="text-xs text-slate-500">{r.buyer.country} · <span className="font-mono">{r.buyer.approvedNo}</span></div>
                    </td>
                    <td className="max-w-56 px-3 py-2.5 text-xs text-slate-600">{r.buyer.sectors.map((s) => s.name).join(", ")}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100"><div className={cn("h-2 rounded-full", n >= pool.target ? "bg-tx-green" : "bg-tx-yellow")} style={{ width: `${pct}%` }} /></div>
                        <span className="w-12 text-right text-xs font-semibold tabular-nums">{n}/{pool.target}</span>
                      </div>
                      {unpublished && <div className="mt-1 text-[11px] font-medium text-amber-700">Unpublished changes</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-violet-700">{src("PREFERENCE") || <span className="text-slate-300">0</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sky-700">{src("SYSTEM") || <span className="text-slate-300">0</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{src("MANUAL") || <span className="text-slate-300">0</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.preferredBy}</td>
                    <td className="px-3 py-2.5">
                      {iss.length ? <Badge tone={iss.some((i) => i.severity === "high") ? "red" : "amber"}><AlertTriangle className="size-3" /> {iss.length}</Badge> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-2 py-2.5"><Link href={`${base}/buyers/${r.buyer.id}`} aria-label={`Open ${r.buyer.name}`} className="inline-grid size-8 place-items-center rounded-lg text-slate-400 group-hover:bg-white group-hover:text-brand-700"><ChevronRight className="size-4" /></Link></td>
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">{rows.length ? "No buyers match the filters." : "No approved buyers yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
