import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SlotFill } from "@/components/event/slot-fill";

export const metadata: Metadata = { title: "Fill a slot" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SlotFill user={await requireUser("DIC")} id={(await params).id} back="/dic/event/live" />;
}
