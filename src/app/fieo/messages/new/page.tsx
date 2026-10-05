import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { StaffCompose } from "@/components/comms/staff";

export const metadata: Metadata = { title: "New communication" };

export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireUser("FIEO");
  return <StaffCompose user={user} base="/fieo" mode={(await searchParams).mode} />;
}
