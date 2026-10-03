import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PublishedMapping } from "@/components/match/published";

export const metadata: Metadata = { title: "Published mapping" };
export default async function Page() {
  const user = await requireUser("DIC");
  return <PublishedMapping user={user} staffBase="/dic" />;
}
