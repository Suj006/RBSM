import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { TicketPage } from "@/components/event/tickets";

export const metadata: Metadata = { title: "Meeting ticket" };

export default async function Page({ params }: { params: Promise<{ ticket: string }> }) {
  return <TicketPage user={await requireUser("SELLER")} ticketNo={decodeURIComponent((await params).ticket)} />;
}
