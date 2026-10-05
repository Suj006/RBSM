import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { NodalMouList } from "@/components/mou/staff";

export const metadata: Metadata = { title: "MoUs to verify" };
export default async function Page() {
  return <NodalMouList user={await requireUser("NODAL")} />;
}
