import { requireUser } from "@/lib/auth";
import { DemandDetailPage } from "@/components/demand/demand-pages";

export default async function Page({ params }: { params: Promise<{ sectorId: string }> }) {
  const user = await requireUser("DIC");
  return <DemandDetailPage user={user} base="/dic/demand" sectorId={(await params).sectorId} buyerBase="/dic/buyers" sellerBase="/dic/sellers" />;
}
