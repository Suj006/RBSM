import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { NodalPage } from "@/components/event/setup";

export const metadata: Metadata = { title: "Nodal officers" };

export default async function Page() {
  return <NodalPage user={await requireUser("FIEO")} />;
}
