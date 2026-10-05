import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { LiveMonitor } from "@/components/event/live";

export const metadata: Metadata = { title: "Live monitor" };

export default async function Page({ searchParams }: { searchParams: Promise<{ day?: string; at?: string }> }) {
  const user = await requireUser("DIC");
  const sp = await searchParams;
  return <LiveMonitor user={user} base="/dic/event" day={sp.day} at={sp.at} />;
}
