import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { MasterPage } from "@/components/admin/master-page";

export const metadata: Metadata = { title: "Certification master" };
export default async function Page() {
  const items = await prisma.certification.findMany({ orderBy: { name: "asc" } });
  return <MasterPage kind="certification" title="Certification master" subtitle="Certifications buyers can require for each sector. Buyers can also add their own." items={items} />;
}
