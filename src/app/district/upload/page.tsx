import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BulkUpload } from "@/components/seller/bulk-upload";

export const metadata: Metadata = { title: "Bulk upload" };
export default async function Page() {
  const user = await requireUser("DISTRICT");
  return (
    <>
      <PageHeader back={{ href: "/district/sellers", label: "Back to sellers", from: [{ href: "/district", label: "Back to dashboard" }] }} eyebrow={user.district ?? undefined} title="Bulk upload of sellers"
        subtitle="Register many sellers at once from the Excel template. Every row is checked; only valid rows are imported." />
      <BulkUpload district={user.district ?? ""} />
    </>
  );
}
