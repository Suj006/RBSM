import { getCurrentUser } from "@/lib/auth";
import { buildTemplate } from "@/lib/seller-bulk";
import { DISTRICTS } from "@/lib/config";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DISTRICT" || !user.district) return new Response("Forbidden", { status: 403 });
  const code = DISTRICTS.find((d) => d.name === user.district)?.code.toUpperCase() ?? "DIST";
  const body = await buildTemplate(user.district);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="TRADEX-RBSM-Seller-Upload-Template-${code}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
