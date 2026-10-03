import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MatchBoard, type BoardFilters } from "@/components/match/board";

export const metadata: Metadata = { title: "Mapping board" };
export default async function Page({ searchParams }: { searchParams: Promise<BoardFilters> }) {
  const user = await requireUser("ADMIN");
  return <MatchBoard user={user} base="/admin/matchmaking" filters={await searchParams} />;
}
