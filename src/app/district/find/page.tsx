import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { IdLookup } from "@/components/lookup";

export const metadata: Metadata = { title: "Find by ID" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <IdLookup user={await requireUser("DISTRICT")} base="/district" q={(await searchParams).q} />;
}
