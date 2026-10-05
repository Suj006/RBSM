import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MouNew } from "@/components/mou/participant";

export const metadata: Metadata = { title: "New MoU" };
export default async function Page({ searchParams }: { searchParams: Promise<{ sellerId?: string }> }) {
  return <MouNew user={await requireUser("BUYER")} sellerId={(await searchParams).sellerId} />;
}
