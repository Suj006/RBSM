import Link from "next/link";
import { Check, Search, X } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { getMatchState, loadPool, preferenceOutcomes } from "@/lib/matchmaking";
import { reopenPreferencesAction } from "@/app/actions/matchmaking";
import { fmtDateTime } from "@/lib/format";
import { DISTRICT_NAMES } from "@/lib/config";
import { Badge, Button, Card, CardHeader, Input, PageHeader, Select, StatCard } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { ActionButton } from "./action-button";

export type PrefFilters = { q?: string; district?: string; show?: string };

/** Every seller's preferences and how many made it into the mapping. */
export async function PreferencesPage({ user, base, staffBase, filters }: { user: User; base: string; staffBase: string; filters: PrefFilters }) {
  const [{ rows, summary }, state, pool] = await Promise.all([preferenceOutcomes(), getMatchState(), loadPool()]);
  const q = filters.q?.trim().toLowerCase();
  const list = rows.filter((r) =>
    (!q || r.name.toLowerCase().includes(q) || (r.approvedNo ?? "").toLowerCase().includes(q)) &&
    (!filters.district || r.district === filters.district) &&
    (filters.show === "submitted" ? !!r.prefSubmittedAt : filters.show === "none" ? !r.prefSubmittedAt : filters.show === "unmet" ? r.prefs.length > 0 && r.honouredDraft === 0 : true));
  const popular = pool.buyers.map((b) => ({ b, n: pool.prefs.filter((p) => p.buyerId === b.id).length, first: pool.prefs.filter((p) => p.buyerId === b.id && p.rank === 1).length }))
    .filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 10);
  const mark = (inList: boolean) => inList ? <Check className="size-3.5 text-brand-600" /> : <X className="size-3.5 text-slate-300" />;

  return (
    <>
      <PageHeader eyebrow="Matchmaking" title="Seller preferences"
        subtitle="Each approved seller's tentative preferences (up to 5 buyers, in order) and whether each one is in the working list and in the published mapping."
        actions={<DownloadButtons href="/api/reports/seller-preferences" label="Preferences report" compact />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sellers who submitted" value={`${summary.submitted} / ${summary.sellers}`} accent="violet" hint={state.prefsFrozen ? "Preferences are frozen" : "Preferences are open"} />
        <StatCard label="Preferences given" value={summary.preferences} accent="blue" />
        <StatCard label="Included in working list" value={`${summary.honouredDraft} / ${summary.preferences}`} accent="green" hint={`${summary.firstChoiceDraft} sellers got their first choice`} />
        <StatCard label="Included in published mapping" value={state.version ? `${summary.honouredPublished} / ${summary.preferences}` : "—"} accent="yellow" hint={state.version ? `Version ${state.version}` : "Not published yet"} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="min-w-0 overflow-hidden">
          <form action={`${base}/preferences`} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[1.4fr_1fr_1.2fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input name="q" defaultValue={filters.q} placeholder="Search seller or seller no.…" className="pl-9" aria-label="Search" />
            </div>
            <Select name="district" defaultValue={filters.district ?? ""} aria-label="District">
              <option value="">All districts</option>
              {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
            </Select>
            <Select name="show" defaultValue={filters.show ?? ""} aria-label="Show">
              <option value="">All approved sellers</option>
              <option value="submitted">Submitted preferences</option>
              <option value="none">Not submitted</option>
              <option value="unmet">No preference included</option>
            </Select>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
          <div className="table-scroll relative overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Seller</th>
                  {[1, 2, 3, 4, 5].map((n) => <th key={n} className="px-2 py-2.5 text-left">#{n}</th>)}
                  <th className="px-3 py-2.5 text-right">Included</th><th className="px-3 py-2.5 text-right">Buyers mapped</th><th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link href={`${staffBase}/sellers/${r.id}`} className="font-semibold text-ink hover:text-brand-700">{r.name}</Link>
                      <div className="text-xs text-slate-500">{r.district} · {r.prefSubmittedAt ? `submitted ${fmtDateTime(r.prefSubmittedAt)}` : "not submitted"}</div>
                    </td>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const p = r.prefs.find((x) => x.rank === n);
                      return (
                        <td key={n} className="max-w-36 px-2 py-2.5 text-xs">
                          {p ? (
                            <div title={`Working list: ${p.inDraft ? "yes" : "no"} · Published: ${p.inPublished ? "yes" : "no"}`}>
                              <Link href={`${base}/buyers/${p.buyerId}`} className="font-medium text-ink hover:text-brand-700">{p.buyer}</Link>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500"><span className="inline-flex items-center gap-0.5">{mark(p.inDraft)} list</span>
                                {state.version > 0 && <span className="inline-flex items-center gap-0.5">{mark(p.inPublished)} published</span>}</div>
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.prefs.length ? <b className={r.honouredDraft ? "text-brand-700" : "text-tx-red"}>{r.honouredDraft}/{r.prefs.length}</b> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.matchedDraft}{state.version > 0 && <span className="text-slate-400"> · pub {r.matchedPublished}</span>}</td>
                    <td className="px-3 py-2.5 text-right">
                      {!state.prefsFrozen && r.prefSubmittedAt && (user.role === "DIC" || user.role === "ADMIN") && (
                        <ActionButton action={reopenPreferencesAction} fields={{ sellerId: r.id }} compact variant="ghost" label="Allow resubmission"
                          confirm={`Clear ${r.name}'s preferences so the seller can submit again?`} />
                      )}
                    </td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No sellers match the filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Most preferred buyers" subtitle="Sellers listing the buyer (first choices)" />
          <ul className="divide-y divide-slate-100">
            {popular.map(({ b, n, first }) => (
              <li key={b.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <Link href={`${base}/buyers/${b.id}`} className="min-w-0 truncate font-medium text-ink hover:text-brand-700">{b.name}</Link>
                <span className="shrink-0 text-xs text-slate-500"><b className="text-ink">{n}</b> ({first} first)</span>
              </li>
            ))}
            {!popular.length && <li className="px-5 py-4 text-sm text-slate-500">No preferences yet.</li>}
          </ul>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <Badge tone="slate">Allow resubmission</Badge> clears one seller&apos;s preferences while preferences are open (for example, after Admin reopens them).
          </p>
        </Card>
      </div>
    </>
  );
}
