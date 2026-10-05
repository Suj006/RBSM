import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MouStaffView } from "@/components/mou/staff";

export const metadata: Metadata = { title: "MoU" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MouStaffView user={await requireUser("DIC")} id={(await params).id} base="/dic/mou" back="/dic/mou/list" />;
}
