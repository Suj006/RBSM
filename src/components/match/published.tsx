import Link from "next/link";
import { Handshake } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { getMatchState, publishedMatches } from "@/lib/matchmaking";
import { fmtDateTime, parseCerts } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { SourceBadges } from "./badges";
import { CountryTag, Flag, UidPill, uid } from "@/components/ids";

/** The published mapping for staff: buyer by buyer (FIEO, Directorate, Admin) or, for a district, its sellers. */
export async function PublishedMapping({ user, staffBase, back }: { user: User; staffBase: string; back?: { href: string; label: string } }) {
  const district = user.role === "DISTRICT" ? user.district ?? "" : undefined;
  const [state, rows] = await Promise.all([getMatchState(), publishedMatches({ sellerDistrict: district })]);
  const internal = user.role === "DIC" || user.role === "ADMIN";
  const head = (
    <PageHeader back={back} eyebrow="Matchmaking" title={district ? `Buyer meetings — ${district} sellers` : "Published buyer–seller mapping"}
      subtitle={state.version
        ? `Version ${state.version}, published ${fmtDateTime(state.publishedAt)}${state.locked ? " · final (locked)" : ""}.`
        : "The Directorate has not published the mapping yet."}
      actions={state.version ? <DownloadButtons href="/api/reports/match-list" label="Mapping" compact /> : undefined} />
  );
  if (!state.version) return <>{head}<Card><EmptyState icon={<Handshake className="size-5" />} title="Not published yet">The mapping appears here once the Directorate publishes it.</EmptyState></Card></>;

  if (district) {
    const sellers = [...new Map(rows.map((r) => [r.seller.id, r.seller])).values()];
    return (
      <>
        {head}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Sellers from your district with buyers" value={sellers.length} accent="green" />
          <StatCard label="Buyer meetings" value={rows.length} accent="blue" />
          <StatCard label="Buyer countries" value={new Set(rows.map((r) => r.buyer.country)).size} accent="violet" />
        </div>
        <div className="space-y-4">
          {sellers.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
                <div><Link href={`${staffBase}/sellers/${s.id}`} className="font-bold text-ink hover:text-brand-700">{s.name}</Link>
                  <span className="ml-2 font-mono text-xs text-slate-500">{s.approvedNo}</span></div>
                <Badge tone="green">{rows.filter((r) => r.seller.id === s.id).length} buyers</Badge>
              </div>
              <ul className="divide-y divide-slate-100">
                {rows.filter((r) => r.seller.id === s.id).map((r) => (
                  <li key={r.id} className="grid gap-1 px-5 py-2.5 text-sm sm:grid-cols-[1fr_1.4fr]">
                    <div className="flex flex-wrap items-center gap-1.5"><Flag country={r.buyer.country} /> <span className="font-medium text-ink">{r.buyer.name}</span> <UidPill id={uid(r.buyer)} tone="buyer" /> <CountryTag country={r.buyer.country} flag={false} className="text-xs text-slate-500" /></div>
                    <div className="text-xs text-slate-600">{r.buyer.requirement?.items.map((i) => `${i.sector.name}: ${i.products}`).join(" · ")}</div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {!sellers.length && <Card><EmptyState icon={<Handshake className="size-5" />} title="No seller from your district is in the published mapping" /></Card>}
        </div>
      </>
    );
  }

  const buyers = [...new Map(rows.map((r) => [r.buyer.id, r.buyer])).values()];
  return (
    <>
      {head}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Buyers" value={buyers.length} accent="blue" />
        <StatCard label="Buyer–seller pairs" value={rows.length} accent="green" />
        <StatCard label="Sellers" value={new Set(rows.map((r) => r.seller.id)).size} accent="violet" />
      </div>
      <div className="space-y-4">
        {buyers.map((b) => {
          const mine = rows.filter((r) => r.buyer.id === b.id);
          return (
            <Card key={b.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <div>
                  <Link href={`${staffBase}/buyers/${b.id}`} className="font-bold text-ink hover:text-brand-700">{b.name}</Link>
                  <span className="ml-2 inline-flex items-center gap-1.5 text-sm text-slate-500"><UidPill id={uid(b)} tone="buyer" /> <CountryTag country={b.country} name /></span>
                  <div className="text-xs text-slate-500">{b.requirement?.items.map((i) => i.sector.name).join(", ")}</div>
                </div>
                <Badge tone="green">{mine.length} sellers</Badge>
              </div>
              <div className="table-scroll relative overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {mine.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="w-8 px-4 py-2 text-slate-400 tabular-nums">{r.slot}</td>
                        <td className="px-2 py-2"><Link href={`${staffBase}/sellers/${r.seller.id}`} className="font-medium text-ink hover:text-brand-700">{r.seller.name}</Link>
                          <div className="text-xs text-slate-500">{r.seller.district}{r.seller.exportExperience ? " · export experience" : ""}{r.seller.iecNo ? " · IEC" : ""}</div>
                          {parseCerts(r.seller.certifications).length > 0 && <div className="text-[11px] text-brand-700">{parseCerts(r.seller.certifications).join(", ")}</div>}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{r.seller.products.map((p) => `${p.sector.name}: ${p.products}`).join(" · ")}</td>
                        {internal && <td className="px-4 py-2 text-right"><SourceBadges source={r.source} prefRank={null} /></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
