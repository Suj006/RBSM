import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MatchOverview } from "@/components/match/overview";

export const metadata: Metadata = { title: "Matchmaking" };
export default async function Page() {
  const user = await requireUser("DIC");
  return <MatchOverview user={user} base="/dic/matchmaking" />;
}
