import type { MatchSource } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui";

/** Where a pair came from, and the seller's preference rank if they listed this buyer. */
export function SourceBadges({ source, prefRank }: { source: MatchSource; prefRank: number | null }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {source === "PREFERENCE" && <Badge tone="violet">Seller preference</Badge>}
      {source === "SYSTEM" && <Badge tone="blue">System match</Badge>}
      {source === "MANUAL" && <Badge tone="amber">Manual</Badge>}
      {prefRank && source !== "PREFERENCE" && <Badge tone="violet">Preferred #{prefRank}</Badge>}
      {prefRank && source === "PREFERENCE" && <Badge tone="violet">#{prefRank}</Badge>}
    </span>
  );
}

export function StateBadge({ on, onLabel, offLabel, tone = "green" }: { on: boolean; onLabel: string; offLabel: string; tone?: "green" | "red" | "violet" | "amber" }) {
  return on ? <Badge tone={tone}>{onLabel}</Badge> : <Badge tone="slate">{offLabel}</Badge>;
}
