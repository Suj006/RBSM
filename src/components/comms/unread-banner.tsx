import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { unreadTotal } from "@/lib/comms";

/** "You have N unread messages" — on dashboards, only when there is something to read. */
export async function UnreadBanner({ user, href }: { user: User; href: string }) {
  const n = await unreadTotal(user);
  if (!n) return null;
  return (
    <Link href={href} className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-sky-50 px-5 py-4 text-sky-900 ring-1 ring-sky-200 hover:bg-sky-100">
      <span className="flex items-center gap-3"><MessagesSquare className="size-5 shrink-0" />
        <span><b>{n} unread message{n > 1 ? "s" : ""}</b> — discussions, programme-desk replies or communications.</span></span>
      <span className="shrink-0 text-sm font-semibold">Open messages →</span>
    </Link>
  );
}
