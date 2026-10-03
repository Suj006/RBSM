import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, PageHeader } from "@/components/ui";
import { SellerForm } from "@/components/seller/seller-form";
import { SELLER_DISTRICT_EDITABLE } from "@/lib/status";
import { sellerFormValues } from "@/lib/seller-form-defaults";

export const metadata: Metadata = { title: "Edit seller" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("DISTRICT");
  const { id } = await params;
  const s = await prisma.seller.findFirst({ where: { id, district: user.district ?? "" }, include: { products: { orderBy: { sortOrder: "asc" } } } });
  if (!s) notFound();
  const sectors = await prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return (
    <>
      <PageHeader back={{ href: `/district/sellers/${s.id}`, label: "Back to seller" }} eyebrow={s.regNo} title={`Edit — ${s.name}`} />
      {SELLER_DISTRICT_EDITABLE.includes(s.status) ? (
        <SellerForm mode="district" district={s.district} backHref={`/district/sellers/${s.id}`} sectors={sectors}
          initial={sellerFormValues(s)} />
      ) : (
        <Alert tone="amber">This seller is with the Directorate or already decided, so it can no longer be edited.</Alert>
      )}
    </>
  );
}
