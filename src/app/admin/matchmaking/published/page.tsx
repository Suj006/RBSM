import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PublishedMapping } from "@/components/match/published";

export const metadata: Metadata = { title: "Published mapping" };
export default async function Page() {
  const user = await requireUser("ADMIN");
  return <PublishedMapping user={user} staffBase="/admin" back={{ href: "/admin/matchmaking", label: "Back to matchmaking" }} />;
}
