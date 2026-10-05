import type { Metadata } from "next";
import { StaffDashboard } from "@/components/staff/dashboard";
import { SellerOverview } from "@/components/seller/seller-overview";
import { SectorPosition } from "@/components/staff/sector-position";
import { MatchStatusBand } from "@/components/match/status-band";
import { requireUser } from "@/lib/auth";
import { UnreadBanner } from "@/components/comms/unread-banner";

export const metadata: Metadata = { title: "Directorate dashboard" };
export default async function Page() {
  const user = await requireUser("DIC");
  return (
    <>
      <UnreadBanner user={user} href="/dic/messages" />
      <StaffDashboard role="DIC" base="/dic" />
      <SellerOverview user={user} base="/dic" />
      <MatchStatusBand user={user} base="/dic" />
      <SectorPosition user={user} base="/dic" />
    </>
  );
}
