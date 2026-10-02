import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { TargetsPage } from "@/components/targets/targets-page";

export const metadata: Metadata = { title: "Targets" };
export default async function Page() {
  await requireUser("DIC");
  return <TargetsPage />;
}
