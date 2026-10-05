import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PlacePair } from "@/components/event/schedule";

export const metadata: Metadata = { title: "Place meeting" };

export default async function Page({ searchParams }: { searchParams: Promise<{ buyerId?: string; sellerId?: string }> }) {
  await requireUser("DIC");
  const sp = await searchParams;
  return <PlacePair base="/dic/event" buyerId={sp.buyerId ?? ""} sellerId={sp.sellerId ?? ""} />;
}
