import type { Metadata } from "next";
import { StaffDashboard } from "@/components/staff/dashboard";
import { SellerOverview } from "@/components/seller/seller-overview";
import { SectorPosition } from "@/components/staff/sector-position";
import { MatchStatusBand } from "@/components/match/status-band";
import { requireUser } from "@/lib/auth";
import { UnreadBanner } from "@/components/comms/unread-banner";

export const metadata: Metadata = { title: "FIEO dashboard" };
export default async function Page() {
  const user = await requireUser("FIEO");
  return (
    <>
      <UnreadBanner user={user} href="/fieo/messages" />
      <StaffDashboard role="FIEO" base="/fieo" />
      <SellerOverview user={user} base="/fieo" />
      <MatchStatusBand user={user} base="/fieo" />
      <SectorPosition user={user} base="/fieo" />
    </>
  );
}
