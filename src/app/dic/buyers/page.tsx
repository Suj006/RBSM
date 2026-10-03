import type { Metadata } from "next";
import { BuyerListPage } from "@/components/staff/buyer-list-page";
import type { BuyerFilters } from "@/lib/buyer-query";

export const metadata: Metadata = { title: "Buyers" };
export default async function Page({ searchParams }: { searchParams: Promise<BuyerFilters> }) {
  return <BuyerListPage role="DIC" base="/dic/buyers" filters={await searchParams} title="Buyers"
    subtitle="Every registered buyer at every stage. Sectors recommended by FIEO wait for your approval — filter by “Awaiting my approval”." />;
}
