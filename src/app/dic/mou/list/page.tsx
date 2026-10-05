import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MouRegister, type MouFilters } from "@/components/mou/staff";

export const metadata: Metadata = { title: "All MoUs" };
export default async function Page({ searchParams }: { searchParams: Promise<MouFilters> }) {
  await requireUser("DIC");
  return <MouRegister base="/dic/mou" filters={await searchParams} />;
}
