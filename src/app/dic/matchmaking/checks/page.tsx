import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MatchChecks } from "@/components/match/checks";

export const metadata: Metadata = { title: "Mapping checks" };
export default async function Page() {
  await requireUser("DIC");
  return <MatchChecks base="/dic/matchmaking" />;
}
