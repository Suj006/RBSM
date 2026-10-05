import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ParticipantInbox } from "@/components/comms/participant";

export const metadata: Metadata = { title: "Messages" };

export default async function Page() {
  const user = await requireUser("SELLER");
  return <ParticipantInbox user={user} base="/seller" />;
}
