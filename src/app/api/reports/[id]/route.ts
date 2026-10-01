import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildDossier, buildReport, isReportId } from "@/lib/reports/data";
import { reportToXlsx } from "@/lib/reports/excel";
import { reportToPdf } from "@/lib/reports/pdf";

// GET /api/reports/<report>?format=xlsx|pdf&<filters>
// GET /api/reports/buyer-profile?buyerId=…&format=pdf|xlsx
export async function GET(req: NextRequest, ctx: RouteContext<"/api/reports/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role === "BUYER" || user.mustChangePassword) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const format = sp.format === "pdf" ? "pdf" : "xlsx";

  const report =
    id === "buyer-profile" ? await buildDossier(user, sp.buyerId ?? "")
    : isReportId(id) ? await buildReport(id, user, sp)
    : null;
  if (!report) return new Response("Report not found", { status: 404 });

  const body = format === "pdf" ? await reportToPdf(report) : await reportToXlsx(report);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // PDFs open in the browser tab; spreadsheets download.
      "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="${report.fileName}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
