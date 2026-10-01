import type { Metadata } from "next";
import { ReportsPage } from "@/components/staff/reports-page";
import type { BuyerFilters } from "@/lib/buyer-query";

export const metadata: Metadata = { title: "Reports" };
export default async function Page({ searchParams }: { searchParams: Promise<BuyerFilters> }) {
  return <ReportsPage role="FIEO" base="/fieo/reports" filters={await searchParams} />;
}
