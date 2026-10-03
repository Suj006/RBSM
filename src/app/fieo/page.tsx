import type { Metadata } from "next";
import { StaffDashboard } from "@/components/staff/dashboard";
import { SellerOverview } from "@/components/seller/seller-overview";
import { SectorPosition } from "@/components/staff/sector-position";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "FIEO dashboard" };
export default async function Page() {
  const user = await requireUser("FIEO");
  return (
    <>
      <StaffDashboard role="FIEO" base="/fieo" />
      <SellerOverview user={user} base="/fieo" />
      <SectorPosition user={user} base="/fieo" />
    </>
  );
}
