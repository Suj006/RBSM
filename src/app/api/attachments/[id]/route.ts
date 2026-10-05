import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { announcementScope, conversationScope, getViewer } from "@/lib/comms";
import { readUpload } from "@/lib/storage";

// GET /api/attachments/<id> — a document shared in a conversation or announcement, only for those who can see it.
export async function GET(_: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Unauthorised", { status: 401 });
  const { id } = await ctx.params;
  const a = await prisma.attachment.findUnique({ where: { id }, include: { message: { select: { conversationId: true, hiddenAt: true } } } });
  if (!a) return new Response("Not found", { status: 404 });
  const v = await getViewer(user);
  const visible = a.message
    ? !!(await prisma.conversation.findFirst({ where: { AND: [{ id: a.message.conversationId }, conversationScope(v)] }, select: { id: true } }))
      && (!a.message.hiddenAt || v.staff || v.admin)
    : a.announcementId
      ? !!(await prisma.announcement.findFirst({ where: { AND: [{ id: a.announcementId }, announcementScope(v)] }, select: { id: true } }))
      : false;
  if (!visible) return new Response("Forbidden", { status: 403 });
  let data: Buffer;
  try { data = await readUpload(a.storedName); } catch { return new Response("File missing", { status: 404 }); }
  const ext = a.storedName.split(".").pop();
  const fileName = `${a.name.replace(/[^\w .-]+/g, "").trim() || "document"}.${ext}`;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": a.mimeType, "Content-Length": String(data.length),
      "Content-Disposition": `${a.mimeType === "application/pdf" || a.mimeType.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
    },
  });
}
