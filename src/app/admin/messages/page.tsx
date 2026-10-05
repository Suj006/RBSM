import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { StaffInbox, type InboxFilters } from "@/components/comms/staff";

export const metadata: Metadata = { title: "Messages" };

export default async function Page({ searchParams }: { searchParams: Promise<InboxFilters> }) {
  const user = await requireUser("ADMIN");
  return <StaffInbox user={user} base="/admin" filters={await searchParams} />;
}
