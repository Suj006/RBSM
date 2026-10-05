import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MouView } from "@/components/mou/participant";

export const metadata: Metadata = { title: "MoU" };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  return <MouView user={await requireUser("BUYER")} id={(await params).id} saved={(await searchParams).saved === "1"} />;
}
