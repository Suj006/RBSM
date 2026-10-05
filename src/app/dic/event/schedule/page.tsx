import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { DraftSchedule } from "@/components/event/schedule";

export const metadata: Metadata = { title: "Draft schedule" };

export default async function Page({ searchParams }: { searchParams: Promise<{ day?: string; view?: string }> }) {
  const user = await requireUser("DIC");
  const sp = await searchParams;
  return <DraftSchedule user={user} base="/dic/event" day={sp.day} view={sp.view} />;
}
