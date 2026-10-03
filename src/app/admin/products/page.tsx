import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ProductDemandPage, type ProductFilters } from "@/components/demand/product-demand-page";

export const metadata: Metadata = { title: "Product demand" };
export default async function Page({ searchParams }: { searchParams: Promise<ProductFilters> }) {
  const user = await requireUser("ADMIN");
  return <ProductDemandPage user={user} root="/admin" filters={await searchParams} />;
}
