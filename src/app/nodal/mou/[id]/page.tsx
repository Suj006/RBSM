import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MouStaffView } from "@/components/mou/staff";

export const metadata: Metadata = { title: "MoU" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MouStaffView user={await requireUser("NODAL")} id={(await params).id} base="/nodal/mou" back="/nodal/mou" />;
}
