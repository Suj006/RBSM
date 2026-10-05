import { getCurrentUser } from "@/lib/auth";
import { buildBuyerTemplate } from "@/lib/buyer-bulk";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "FIEO") return new Response("Forbidden", { status: 403 });
  const body = await buildBuyerTemplate();
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="TRADEX-RBSM-Buyer-Upload-Template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
