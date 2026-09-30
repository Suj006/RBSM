import type { Metadata } from "next";
import { BuyerListPage } from "@/components/staff/buyer-list-page";
import type { BuyerFilters } from "@/lib/buyer-query";

export const metadata: Metadata = { title: "Recommended buyers" };
export default async function Page({ searchParams }: { searchParams: Promise<BuyerFilters> }) {
  return <BuyerListPage role="DIC" base="/dic/buyers" filters={await searchParams} title="Recommended buyers"
    subtitle="Buyers recommended by FIEO — approve to add them to the RBSM buyer list, or return to FIEO with a comment." />;
}
