import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { EventOverview } from "@/components/event/setup";

export const metadata: Metadata = { title: "Event days" };

export default async function Page() {
  const user = await requireUser("DIC");
  return <EventOverview user={user} base="/dic/event" />;
}
