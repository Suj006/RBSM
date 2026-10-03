import type { Metadata } from "next";
import { requireBuyer } from "@/lib/auth";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { BuyerMatches } from "@/components/match/my-matches";
import { Handshake } from "lucide-react";

export const metadata: Metadata = { title: "Matched sellers" };
export default async function Page() {
  const { buyer } = await requireBuyer();
  return (
    <>
      <PageHeader back={{ href: "/buyer", label: "Back to dashboard" }} eyebrow="Matchmaking" title="Your matched Kerala sellers"
        subtitle="Verified MSME sellers selected for one-to-one B2B meetings with you, based on your approved sector requirements." />
      {buyer.status === "APPROVED"
        ? <BuyerMatches buyerId={buyer.id} full />
        : <Card><EmptyState icon={<Handshake className="size-5" />} title="Available after approval">Sellers are matched once the Directorate approves your requirement.</EmptyState></Card>}
    </>
  );
}
