import type { Metadata } from "next";
import { BuyerListPage } from "@/components/staff/buyer-list-page";
import type { BuyerFilters } from "@/lib/buyer-query";

export const metadata: Metadata = { title: "All buyers" };
export default async function Page({ searchParams }: { searchParams: Promise<BuyerFilters> }) {
  return <BuyerListPage role="ADMIN" base="/admin/buyers" filters={await searchParams} title="All buyers"
    subtitle="Every buyer account on the portal, at any stage." />;
}
