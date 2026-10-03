import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getMatchState } from "@/lib/matchmaking";
import { fmtDateTime } from "@/lib/format";
import { SectionBand } from "@/components/section-band";

/** Matchmaking position for a dashboard: where the process stands and the published numbers. */
export async function MatchStatusBand({ user, base }: { user: User; base: string }) {
  const internal = user.role === "DIC" || user.role === "ADMIN";
  const district = user.role === "DISTRICT" ? user.district ?? "" : null;
  const [state, published, draft, prefs, sellers] = await Promise.all([
    getMatchState(),
    prisma.publishedMatch.findMany({ where: district ? { seller: { district } } : {}, select: { buyerId: true, sellerId: true } }),
    internal ? prisma.match.count({ where: { removed: false } }) : Promise.resolve(0),
    internal ? prisma.seller.count({ where: { prefSubmittedAt: { not: null } } }) : Promise.resolve(0),
    internal ? prisma.seller.count({ where: { status: "APPROVED" } }) : Promise.resolve(0),
  ]);
  const pub = state.version
    ? `Published v${state.version} (${fmtDateTime(state.publishedAt)})${state.locked ? " · final" : ""}: ${published.length} pairs, ${new Set(published.map((p) => p.buyerId)).size} buyers, ${new Set(published.map((p) => p.sellerId)).size} sellers${district ? ` from ${district}` : ""}`
    : "Not published yet";
  const summary = internal
    ? `Buyer directory ${state.buyersVisible ? "open" : "hidden"} · preferences ${state.prefsFrozen ? "frozen" : "open"} (${prefs}/${sellers} sellers) · working list ${draft} pairs · ${pub}`
    : pub;
  const links = internal
    ? [{ href: `${base}/matchmaking/results`, label: "Results & gaps" }, { href: `${base}/matchmaking`, label: "Matchmaking →", primary: true }]
    : [{ href: `${base}/matches`, label: user.role === "DISTRICT" ? "Buyer meetings →" : "Buyer–seller mapping →", primary: true }];
  return (
    <section className="mt-10">
      <SectionBand id="matchmaking" kind="programme" title="Buyer–seller matchmaking" summary={summary} links={links} />
    </section>
  );
}
