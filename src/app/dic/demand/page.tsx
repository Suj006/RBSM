import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { DemandSummaryPage } from "@/components/demand/demand-pages";

export const metadata: Metadata = { title: "Sector demand" };
export default async function Page() {
  const user = await requireUser("DIC");
  return <DemandSummaryPage user={user} base="/dic/demand" />;
}
