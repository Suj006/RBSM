import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PavilionsPage } from "@/components/event/setup";

export const metadata: Metadata = { title: "Pavilions" };

export default async function Page() {
  return <PavilionsPage user={await requireUser("FIEO")} />;
}
