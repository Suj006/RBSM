import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ApprovedSellerListPage } from "@/components/seller/approved-seller-list-page";
import type { SellerFilters } from "@/lib/seller-query";

export const metadata: Metadata = { title: "RBSM seller list" };
export default async function Page({ searchParams }: { searchParams: Promise<SellerFilters> }) {
  const user = await requireUser("ADMIN");
  return <ApprovedSellerListPage user={user} base="/admin/seller-list" sellerBase="/admin/sellers" filters={await searchParams} />;
}
