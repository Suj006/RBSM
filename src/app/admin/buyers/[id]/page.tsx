import { BuyerDetailPage } from "@/components/staff/buyer-detail-page";
import { ResetBuyerPassword } from "@/components/admin/reset-password";
import { Card, CardHeader } from "@/components/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <BuyerDetailPage role="ADMIN" id={(await params).id} base="/admin/buyers"
      extra={(buyerId) => (
        <Card className="no-print">
          <CardHeader title="Admin tools" subtitle="Approvals are done by FIEO and the Directorate." />
          <div className="p-5"><ResetBuyerPassword buyerId={buyerId} /></div>
        </Card>
      )} />
  );
}
