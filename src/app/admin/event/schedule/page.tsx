import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { DraftSchedule } from "@/components/event/schedule";

export const metadata: Metadata = { title: "Draft schedule" };

export default async function Page({ searchParams }: { searchParams: Promise<{ day?: string; view?: string }> }) {
  const user = await requireUser("ADMIN");
  const sp = await searchParams;
  return <DraftSchedule user={user} base="/admin/event" day={sp.day} view={sp.view} />;
}
