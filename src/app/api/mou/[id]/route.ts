import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadMou } from "@/lib/mou";
import { mouDocument } from "@/lib/mou-doc";
import { mouToPdf } from "@/lib/mou-pdf";

// GET /api/mou/<id> — the MoU as PDF. Buyer: own MoUs; seller: own approved MoUs; nodal officer: own buyers'; staff: all.
export async function GET(_: Request, ctx: RouteContext<"/api/mou/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Forbidden", { status: 403 });
  const m = await loadMou((await ctx.params).id);
  if (!m) return new Response("Not found", { status: 404 });
  const allowed =
    user.role === "DIC" || user.role === "FIEO" || user.role === "ADMIN" ? true
    : user.role === "BUYER" ? (await prisma.buyer.findUnique({ where: { userId: user.id }, select: { id: true } }))?.id === m.buyerId
    : user.role === "SELLER" ? m.status === "APPROVED" && (await prisma.seller.findFirst({ where: { userId: user.id }, select: { id: true } }))?.id === m.sellerId
    : user.role === "NODAL" ? m.buyer.nodalOfficer?.userId === user.id
    : false;
  if (!allowed) return new Response("Not found", { status: 404 });
  const body = await mouToPdf(await mouDocument(m));
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${m.mouNo}.pdf"`, "Cache-Control": "no-store" },
  });
}
