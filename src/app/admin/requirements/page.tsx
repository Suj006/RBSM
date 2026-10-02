import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { RequirementListPage, type ReqFilters } from "@/components/staff/requirement-list-page";

export const metadata: Metadata = { title: "Sector requirements" };
export default async function Page({ searchParams }: { searchParams: Promise<ReqFilters> }) {
  await requireUser("ADMIN");
  return <RequirementListPage role="ADMIN" base="/admin/requirements" buyerBase="/admin/buyers" filters={await searchParams} />;
}
