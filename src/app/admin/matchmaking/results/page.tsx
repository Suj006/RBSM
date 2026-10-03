import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MatchResults } from "@/components/match/results";

export const metadata: Metadata = { title: "Results & gaps" };
export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  await requireUser("ADMIN");
  return <MatchResults base="/admin/matchmaking" staffBase="/admin" which={(await searchParams).v === "draft" ? "draft" : "published"} />;
}
