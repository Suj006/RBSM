import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { AnnouncementView } from "@/components/comms/participant";

export const metadata: Metadata = { title: "Communication" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const user = await requireUser("FIEO");
  return <AnnouncementView user={user} base="/fieo" id={(await params).id} sent={(await searchParams).sent} back="/fieo/messages?tab=announcements" />;
}
