import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { StaffCompose } from "@/components/comms/staff";

export const metadata: Metadata = { title: "New communication" };

export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireUser("DIC");
  return <StaffCompose user={user} base="/dic" mode={(await searchParams).mode} />;
}
