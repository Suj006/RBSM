import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SellerListPage } from "@/components/seller/seller-list-page";
import type { SellerFilters } from "@/lib/seller-query";

export const metadata: Metadata = { title: "Approved sellers" };
export default async function Page({ searchParams }: { searchParams: Promise<SellerFilters> }) {
  const user = await requireUser("FIEO");
  return <SellerListPage user={user} base="/fieo/sellers" filters={await searchParams} title="Approved sellers"
    subtitle="MSME sellers approved by the Directorate." />;
}
