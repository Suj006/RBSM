import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { StaffConversation } from "@/components/comms/staff";

export const metadata: Metadata = { title: "Conversation" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const user = await requireUser("DIC");
  return <StaffConversation user={user} base="/dic" id={(await params).id} sent={(await searchParams).sent} />;
}
