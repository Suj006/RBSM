import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ParticipantPairThread } from "@/components/comms/participant";

export const metadata: Metadata = { title: "Discussion" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("SELLER");
  return <ParticipantPairThread user={user} base="/seller" otherId={(await params).id} />;
}
