import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MouList } from "@/components/mou/participant";

export const metadata: Metadata = { title: "MoUs" };
export default async function Page() {
  return <MouList user={await requireUser("SELLER")} />;
}
