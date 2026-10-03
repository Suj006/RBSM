import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PublishedMapping } from "@/components/match/published";

export const metadata: Metadata = { title: "Buyer–seller mapping" };
export default async function Page() {
  const user = await requireUser("DISTRICT");
  return <PublishedMapping user={user} staffBase="/district" />;
}
