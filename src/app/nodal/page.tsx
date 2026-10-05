import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { NodalHome } from "@/components/event/nodal-portal";

export const metadata: Metadata = { title: "Nodal officer" };

export default async function Page({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  return <NodalHome user={await requireUser("NODAL")} day={(await searchParams).day} />;
}
