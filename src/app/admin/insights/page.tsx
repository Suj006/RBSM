import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { InsightsPage } from "@/components/staff/insights-page";

export const metadata: Metadata = { title: "Insights" };
export default async function Page() {
  const user = await requireUser("ADMIN");
  return <InsightsPage user={user} root="/admin" />;
}
