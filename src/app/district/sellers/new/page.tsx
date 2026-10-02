import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { SellerForm } from "@/components/seller/seller-form";
import { EMPTY_SELLER } from "@/lib/seller-form-defaults";

export const metadata: Metadata = { title: "Add seller" };
export default async function Page() {
  const user = await requireUser("DISTRICT");
  const sectors = await prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return (
    <>
      <PageHeader back={{ href: "/district/sellers", label: "Back to sellers", from: [{ href: "/district", label: "Back to dashboard" }] }} eyebrow={user.district ?? undefined} title="Add seller" subtitle="Register an MSME seller from your district. You can recommend it to the Directorate straight away or later." />
      <SellerForm mode="district" district={user.district ?? ""} initial={{ ...EMPTY_SELLER, district: user.district ?? "" }} sectors={sectors} backHref="/district/sellers" />
    </>
  );
}
