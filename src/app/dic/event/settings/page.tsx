import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { EventSettings } from "@/components/event/setup";

export const metadata: Metadata = { title: "Event dates & hours" };

export default async function Page() {
  return <EventSettings user={await requireUser("DIC")} />;
}
