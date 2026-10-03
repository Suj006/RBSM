import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PreferencesPage, type PrefFilters } from "@/components/match/preferences";

export const metadata: Metadata = { title: "Seller preferences" };
export default async function Page({ searchParams }: { searchParams: Promise<PrefFilters> }) {
  const user = await requireUser("DIC");
  return <PreferencesPage user={user} base="/dic/matchmaking" staffBase="/dic" filters={await searchParams} />;
}
