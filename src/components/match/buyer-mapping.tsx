import Link from "next/link";
import { notFound } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canEditMatches, fit, loadBoard, matchChecks, whyMatched } from "@/lib/matchmaking";
import { mapPairAction } from "@/app/actions/matchmaking";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { ActionButton } from "./action-button";
import { AddSellerForm } from "./add-seller-form";
import { SourceBadges } from "./badges";
import { Flag } from "@/components/ids";
import { countryCode } from "@/lib/country-codes";

/** One buyer: the sellers mapped, why, and what else would fit. */
export async function BuyerMapping({ user, base, buyerId, staffBase }: { user: User; base: string; buyerId: string; staffBase: string }) {
  const board = await loadBoard();
  const row = board.rows.find((r) => r.buyer.id === buyerId);
  if (!row) notFound();
  const { pool, state } = board;
  const issues = (await matchChecks(board)).filter((i) => i.buyerId === buyerId);
  const editable = user.role === "DIC" && canEditMatches(state);
  const mapped = new Set(row.matches.map((m) => m.sellerId));
  const removed = await prisma.match.findMany({ where: { buyerId, removed: true }, select: { sellerId: true } });
  const removedSet = new Set(removed.map((r) => r.sellerId));
  const load = new Map<string, number>();
  for (const r of board.rows) for (const m of r.matches) load.set(m.sellerId, (load.get(m.sellerId) ?? 0) + 1);
  const suggestions = pool.sellers
    .filter((s) => !mapped.has(s.id))
    .map((s) => ({ s, f: fit(row.buyer, s, pool.prefRank.get(`${buyerId}|${s.id}`) ?? null) }))
    .filter((x) => x.f.score > 0)
    .sort((a, b) => (a.f.prefRank ?? 99) - (b.f.prefRank ?? 99) || b.f.score - a.f.score)
    .slice(0, 15);
  const prefSellers = pool.prefs.filter((p) => p.buyerId === buyerId).sort((a, b) => a.rank - b.rank);

  return (
    <>
      <PageHeader back={{ href: `${base}/board`, label: "Back to mapping board" }} eyebrow={`Matchmaking · ${row.buyer.approvedNo}`} title={<span className="inline-flex items-center gap-2"><Flag country={row.buyer.country} /> {row.buyer.name}</span>}
        subtitle={`${row.buyer.country} (${countryCode(row.buyer.country)}) · ${row.matches.length} of ${pool.target} sellers mapped · preferred by ${row.preferredBy} seller${row.preferredBy === 1 ? "" : "s"}`}
        actions={<Link href={`${staffBase}/buyers/${buyerId}`} className="text-sm font-semibold text-brand-700 hover:underline">Full buyer profile →</Link>} />

      {!editable && (
        <Alert tone="slate" className="mb-6">
          {user.role !== "DIC" ? "View only." : state.locked ? "The mapping is locked — Admin must unlock it before changes." : "Changes are possible once seller preferences are frozen."}
        </Alert>
      )}
      {issues.length > 0 && (
        <Alert tone="amber" className="mb-6" title={`${issues.length} item${issues.length > 1 ? "s" : ""} to review (for reference — publishing is not blocked)`}>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{issues.map((i, n) => <li key={n}><b>{i.kind}</b>{i.seller ? ` — ${i.seller}` : ""}: {i.detail}</li>)}</ul>
        </Alert>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="What the buyer needs" subtitle="Approved sector requirements — sellers are matched against these" />
            <ul className="divide-y divide-slate-100">
              {row.buyer.sectors.map((x) => (
                <li key={x.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[200px_1fr]">
                  <div className="font-semibold text-ink">{x.name}</div>
                  <div className="text-slate-700">
                    {x.products}
                    {x.certifications.length > 0 && <div className="mt-1 text-xs text-slate-500">Certifications: {x.certifications.join(", ")}</div>}
                    {x.quantity && <div className="text-xs text-slate-500">Volume: {x.quantity}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title={`Mapped sellers (${row.matches.length})`} subtitle="Working list — buyers and sellers see it only after it is published" />
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2.5 text-left">Seller</th><th className="px-3 py-2.5 text-left">Common sectors · matching products</th>
                    <th className="px-3 py-2.5 text-left">Source</th><th className="px-3 py-2.5 text-right">Fit</th><th className="px-3 py-2.5 text-right">Buyers</th><th className="px-3 py-2.5" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {row.matches.map((m) => (
                    <tr key={m.sellerId} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link href={`${staffBase}/sellers/${m.sellerId}`} className="font-semibold text-ink hover:text-brand-700">{m.seller.name}</Link>
                        <div className="text-xs text-slate-500">{m.seller.district}{m.seller.exportExperience ? " · export experience" : ""}</div>
                        <div className="mt-0.5 max-w-64 text-[11px] text-slate-500">{m.seller.sectors.map((x) => `${x.name}: ${x.products}`).join(" · ")}</div>
                        {state.version > 0 && !m.inPublished && <div className="mt-0.5 text-[11px] font-semibold text-amber-700">Not yet published</div>}
                      </td>
                      <td className="max-w-72 px-3 py-2.5 text-xs">
                        {m.fit.sectors.length ? <span className="text-ink">{m.fit.sectors.join(", ")}</span> : <span className="font-semibold text-tx-red">No common sector</span>}
                        {m.fit.products.length > 0 && <div className="text-slate-500">Products: {m.fit.products.join(", ")}</div>}
                        {m.fit.certs.length > 0 && <div className="text-brand-700">Certified: {m.fit.certs.join(", ")}</div>}
                      </td>
                      <td className="px-3 py-2.5"><SourceBadges source={m.source} prefRank={m.fit.prefRank} /></td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums" title={whyMatched(m.fit, m.seller, true)}>{m.fit.score}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{load.get(m.sellerId) ?? 0}</td>
                      <td className="px-3 py-2.5 text-right">
                        {editable && <ActionButton action={mapPairAction} fields={{ op: "remove", buyerId, sellerId: m.sellerId }} compact variant="ghost" label={<><Minus className="size-3.5" /> Remove</>} />}
                      </td>
                    </tr>
                  ))}
                  {!row.matches.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No sellers mapped yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Other sellers that fit" subtitle="Best candidates not in the list — seller preferences first. Fit: preference 60–40 · common sector 20 · products 10 each (max 30) · required certifications held 5 each (max 10) · export experience 5" />
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2.5 text-left">Seller</th><th className="px-3 py-2.5 text-left">Common sectors · matching products</th>
                    <th className="px-3 py-2.5 text-right">Fit</th><th className="px-3 py-2.5 text-right">Buyers now</th><th className="px-3 py-2.5" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suggestions.map(({ s, f }) => (
                    <tr key={s.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link href={`${staffBase}/sellers/${s.id}`} className="font-medium text-ink hover:text-brand-700">{s.name}</Link>
                        <div className="text-xs text-slate-500">{s.district}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {f.prefRank && <Badge tone="violet">Preferred #{f.prefRank}</Badge>}
                          {removedSet.has(s.id) && <Badge tone="slate">Removed earlier</Badge>}
                        </div>
                      </td>
                      <td className="max-w-72 px-3 py-2.5 text-xs">{f.sectors.join(", ") || <span className="text-tx-red">No common sector</span>}
                        {f.products.length > 0 && <div className="text-slate-500">Products: {f.products.join(", ")}</div>}
                        {f.certs.length > 0 && <div className="text-brand-700">Certified: {f.certs.join(", ")}</div>}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{f.score}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{load.get(s.id) ?? 0}{(load.get(s.id) ?? 0) >= board.cap && <span className="block text-[11px] text-amber-700">at limit</span>}</td>
                      <td className="px-3 py-2.5 text-right">{editable && <ActionButton action={mapPairAction} fields={{ op: "add", buyerId, sellerId: s.id }} compact label={<><Plus className="size-3.5" /> Add</>} />}</td>
                    </tr>
                  ))}
                  {!suggestions.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No other approved seller fits this buyer&apos;s sectors.</td></tr>}
                </tbody>
              </table>
            </div>
            {editable && (
              <div className="border-t border-slate-100 p-4">
                <AddSellerForm buyerId={buyerId} sellers={pool.sellers.filter((s) => !mapped.has(s.id)).map((s) => ({ id: s.id, label: `${s.name} — ${s.district}` }))} />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Buyer's approved requirement" />
            <ul className="divide-y divide-slate-100">
              {row.buyer.sectors.map((s) => (
                <li key={s.id} className="px-5 py-3 text-sm">
                  <div className="font-semibold text-ink">{s.name}</div>
                  <div className="text-slate-600">{s.products}</div>
                  {s.certifications.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{s.certifications.map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>}
                  {s.quantity && <div className="mt-1 text-xs text-slate-500">Volume: {s.quantity}</div>}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title={`Sellers who preferred this buyer (${prefSellers.length})`} />
            <ul className="divide-y divide-slate-100">
              {prefSellers.map((p) => {
                const s = pool.sellers.find((x) => x.id === p.sellerId);
                return (
                  <li key={p.sellerId} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="min-w-0 truncate"><Badge tone="violet">#{p.rank}</Badge> <span className="font-medium text-ink">{s?.name ?? "—"}</span></span>
                    {mapped.has(p.sellerId) ? <Badge tone="green">In list</Badge> : <Badge tone="slate">Not in list</Badge>}
                  </li>
                );
              })}
              {!prefSellers.length && <li className="px-5 py-4 text-sm text-slate-500">No seller listed this buyer.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
