import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { TicketPage } from "@/components/event/tickets";

export const metadata: Metadata = { title: "My tickets" };

export default async function Page() {
  return <TicketPage user={await requireUser("SELLER")} />;
}
