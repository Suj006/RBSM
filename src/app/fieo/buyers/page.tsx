import type { Metadata } from "next";
import { BuyerListPage } from "@/components/staff/buyer-list-page";
import type { BuyerFilters } from "@/lib/buyer-query";

export const metadata: Metadata = { title: "Buyer applications" };
export default async function Page({ searchParams }: { searchParams: Promise<BuyerFilters> }) {
  return <BuyerListPage role="FIEO" base="/fieo/buyers" filters={await searchParams} title="Buyer applications"
    subtitle="All buyers who have signed up — verify basic details and recommend detailed requirements." />;
}
