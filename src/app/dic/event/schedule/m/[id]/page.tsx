import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MeetingEdit } from "@/components/event/schedule";

export const metadata: Metadata = { title: "Move meeting" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("DIC");
  return <MeetingEdit base="/dic/event" id={(await params).id} />;
}
