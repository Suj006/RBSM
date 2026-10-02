import { requireUser } from "@/lib/auth";
import { SellerDetailPage } from "@/components/seller/seller-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("DIC");
  return <SellerDetailPage user={user} id={(await params).id} base="/dic/sellers" />;
}
