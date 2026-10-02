import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SellerListPage } from "@/components/seller/seller-list-page";
import type { SellerFilters } from "@/lib/seller-query";

export const metadata: Metadata = { title: "All sellers" };
export default async function Page({ searchParams }: { searchParams: Promise<SellerFilters> }) {
  const user = await requireUser("ADMIN");
  return <SellerListPage user={user} base="/admin/sellers" filters={await searchParams} title="All sellers"
    subtitle="Every seller record, at any stage, across all districts." />;
}
