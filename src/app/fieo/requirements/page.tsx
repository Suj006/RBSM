import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { RequirementListPage, type ReqFilters } from "@/components/staff/requirement-list-page";

export const metadata: Metadata = { title: "Sector requirements" };
export default async function Page({ searchParams }: { searchParams: Promise<ReqFilters> }) {
  await requireUser("FIEO");
  return <RequirementListPage role="FIEO" base="/fieo/requirements" buyerBase="/fieo/buyers" filters={await searchParams} />;
}
