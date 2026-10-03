import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";

export async function GET(_: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  const { id } = await ctx.params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { buyer: true },
  });
  if (!doc) return new Response("Not found", { status: 404 });

  const allowed =
    user.role === "ADMIN" || user.role === "FIEO" || user.role === "DIC" ||
    (user.role === "BUYER" && doc.buyer.userId === user.id);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  let data: Buffer;
  try {
    data = await readUpload(doc.storedName);
  } catch {
    return new Response("File missing", { status: 404 });
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
