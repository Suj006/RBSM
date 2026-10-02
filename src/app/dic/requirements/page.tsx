import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { RequirementListPage, type ReqFilters } from "@/components/staff/requirement-list-page";

export const metadata: Metadata = { title: "Sector requirements" };
export default async function Page({ searchParams }: { searchParams: Promise<ReqFilters> }) {
  await requireUser("DIC");
  return <RequirementListPage role="DIC" base="/dic/requirements" buyerBase="/dic/buyers" filters={await searchParams} />;
}
