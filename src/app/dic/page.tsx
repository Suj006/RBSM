import type { Metadata } from "next";
import { StaffDashboard } from "@/components/staff/dashboard";
import { SellerOverview } from "@/components/seller/seller-overview";
import { SectorPosition } from "@/components/staff/sector-position";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Directorate dashboard" };
export default async function Page() {
  const user = await requireUser("DIC");
  return (
    <>
      <StaffDashboard role="DIC" base="/dic" />
      <SellerOverview user={user} base="/dic" />
      <SectorPosition user={user} base="/dic" />
    </>
  );
}
