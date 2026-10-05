import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ParticipantDesk } from "@/components/comms/participant";

export const metadata: Metadata = { title: "Programme desk" };

export default async function Page() {
  const user = await requireUser("SELLER");
  return <ParticipantDesk user={user} base="/seller" />;
}
