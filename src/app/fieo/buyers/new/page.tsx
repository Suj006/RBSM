import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACCEPT_ATTR } from "@/lib/storage";
import { PageHeader } from "@/components/ui";
import { AddBuyerForm } from "@/components/staff/add-buyer";

export const metadata: Metadata = { title: "Add a buyer" };
export default async function Page() {
  await requireUser("FIEO");
  const sectors = await prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return (
    <>
      <PageHeader back={{ href: "/fieo/buyers", label: "Back to buyer applications" }} eyebrow="Buyers" title="Add a buyer"
        subtitle="Register an international buyer on their behalf. The buyer gets a temporary login by e-mail, which becomes their permanent login once the Directorate approves them." />
      <AddBuyerForm sectors={sectors} accept={ACCEPT_ATTR} />
    </>
  );
}
