import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { MasterPage } from "@/components/admin/master-page";

export const metadata: Metadata = { title: "Sector master" };
export default async function Page() {
  const sectors = await prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { requirementItems: true } } } });
  return <MasterPage kind="sector" title="Sector master" subtitle="Sectors buyers choose from in the detailed requirement."
    items={sectors.map((s) => ({ ...s, usage: s._count.requirementItems }))} />;
}
