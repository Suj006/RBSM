import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { StaffConversation } from "@/components/comms/staff";

export const metadata: Metadata = { title: "Conversation" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const user = await requireUser("FIEO");
  return <StaffConversation user={user} base="/fieo" id={(await params).id} sent={(await searchParams).sent} />;
}
