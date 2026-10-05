import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MouStaffView } from "@/components/mou/staff";

export const metadata: Metadata = { title: "MoU" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MouStaffView user={await requireUser("FIEO")} id={(await params).id} base="/fieo/mou" back="/fieo/mou/list" />;
}
