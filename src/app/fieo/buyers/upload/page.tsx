import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BuyerBulkUpload } from "@/components/staff/add-buyer";

export const metadata: Metadata = { title: "Bulk upload of buyers" };
export default async function Page() {
  await requireUser("FIEO");
  return (
    <>
      <PageHeader back={{ href: "/fieo/buyers", label: "Back to buyer applications" }} eyebrow="Buyers" title="Bulk upload of buyers"
        subtitle="Register many buyers at once from the Excel template. Every row is checked; only valid rows are imported, and each buyer gets a temporary login by e-mail." />
      <BuyerBulkUpload />
    </>
  );
}
