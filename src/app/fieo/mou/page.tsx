import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MouDashboard } from "@/components/mou/dashboard";

export const metadata: Metadata = { title: "MoU dashboard" };
export default async function Page({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  return <MouDashboard user={await requireUser("FIEO")} base="/fieo/mou" scope={(await searchParams).scope} />;
}
