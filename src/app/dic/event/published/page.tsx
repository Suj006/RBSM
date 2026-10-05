import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PublishedSchedule } from "@/components/event/schedule";

export const metadata: Metadata = { title: "Published schedule" };

export default async function Page({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requireUser("DIC");
  return <PublishedSchedule base="/dic/event" day={(await searchParams).day} />;
}
