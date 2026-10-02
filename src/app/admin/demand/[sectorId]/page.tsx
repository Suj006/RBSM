import { requireUser } from "@/lib/auth";
import { DemandDetailPage } from "@/components/demand/demand-pages";

export default async function Page({ params }: { params: Promise<{ sectorId: string }> }) {
  const user = await requireUser("ADMIN");
  return <DemandDetailPage user={user} base="/admin/demand" sectorId={(await params).sectorId} buyerBase="/admin/buyers" sellerBase="/admin/sellers" />;
}
