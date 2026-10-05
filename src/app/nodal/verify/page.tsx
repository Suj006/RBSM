import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { NodalVerify } from "@/components/event/nodal-portal";

export const metadata: Metadata = { title: "Verify a ticket" };

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  return <NodalVerify user={await requireUser("NODAL")} t={(await searchParams).t} />;
}
