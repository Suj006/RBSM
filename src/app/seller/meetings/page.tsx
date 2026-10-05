import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MyMeetings } from "@/components/event/tickets";

export const metadata: Metadata = { title: "My meetings" };

export default async function Page() {
  return <MyMeetings user={await requireUser("SELLER")} base="/seller" />;
}
