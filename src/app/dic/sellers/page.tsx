import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SellerListPage } from "@/components/seller/seller-list-page";
import type { SellerFilters } from "@/lib/seller-query";

export const metadata: Metadata = { title: "Seller approvals" };
export default async function Page({ searchParams }: { searchParams: Promise<SellerFilters> }) {
  const user = await requireUser("DIC");
  return <SellerListPage user={user} base="/dic/sellers" filters={await searchParams} title="Seller approvals"
    subtitle="Sellers recommended by the District Industries Centres. Tick sellers to approve them together, or open one to return or reject it." />;
}
