import { BuyerDetailPage } from "@/components/staff/buyer-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <BuyerDetailPage role="FIEO" id={(await params).id} base="/fieo/buyers" />;
}
