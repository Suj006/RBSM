import type { Metadata } from "next";
import { StaffDashboard } from "@/components/staff/dashboard";
import { SellerOverview } from "@/components/seller/seller-overview";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin dashboard" };
export default async function Page() {
  const user = await requireUser("ADMIN");
  return (
    <>
      <StaffDashboard role="ADMIN" base="/admin" />
      <SellerOverview user={user} base="/admin" />
    </>
  );
}
