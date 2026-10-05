import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { StaffInbox, type InboxFilters } from "@/components/comms/staff";

export const metadata: Metadata = { title: "Messages" };

export default async function Page({ searchParams }: { searchParams: Promise<InboxFilters> }) {
  const user = await requireUser("DIC");
  return <StaffInbox user={user} base="/dic" filters={await searchParams} />;
}
