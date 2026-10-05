import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { AnnouncementView } from "@/components/comms/participant";

export const metadata: Metadata = { title: "Communication" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const user = await requireUser("BUYER");
  return <AnnouncementView user={user} base="/buyer" id={(await params).id} sent={(await searchParams).sent} />;
}
