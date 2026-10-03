import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BuyerMapping } from "@/components/match/buyer-mapping";

export const metadata: Metadata = { title: "Buyer mapping" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("DIC");
  return <BuyerMapping user={user} base="/dic/matchmaking" staffBase="/dic" buyerId={(await params).id} />;
}
