import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EyeOff, Lock, Snowflake } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMatchState, loadPool } from "@/lib/matchmaking";
import { fmtDateTime } from "@/lib/format";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { BuyerDirectory } from "@/components/match/buyer-directory";

export const metadata: Metadata = { title: "Buyers & preferences" };

export default async function Page() {
  const user = await requireUser("SELLER");
  const seller = await prisma.seller.findUnique({
    where: { userId: user.id },
    include: { products: { select: { sectorId: true } }, preferences: { orderBy: { rank: "asc" }, include: { buyer: { select: { name: true, country: true } } } } },
  });
  if (!seller || seller.status !== "APPROVED") redirect("/seller");
  const state = await getMatchState();
  const header = (
    <PageHeader back={{ href: "/seller", label: "Back to dashboard" }} eyebrow="Matchmaking" title="International buyers"
      subtitle="Approved buyers with the products, specifications and certifications they need. Choose up to 5 as your tentative preferences." />
  );
  if (!state.buyersVisible) {
    return <>{header}<Card><EmptyState icon={<EyeOff className="size-5" />} title="Buyer details are not open yet">
      The Directorate will open the approved buyer list to sellers before preferences are collected. You will be able to see it here.
    </EmptyState></Card></>;
  }
  const [pool, sectors] = await Promise.all([
    loadPool(),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const mine = new Set(seller.products.map((p) => p.sectorId));
  const buyers = pool.buyers
    .map((b) => ({ id: b.id, name: b.name, approvedNo: b.approvedNo, country: b.country, relevant: b.sectors.some((s) => mine.has(s.id)),
      sectors: b.sectors.map((s) => ({ id: s.id, name: s.name, products: s.products, specifications: s.specifications, certifications: s.certifications, quantity: s.quantity })) }))
    .sort((a, b) => Number(b.relevant) - Number(a.relevant) || a.name.localeCompare(b.name));
  const usedSectors = sectors.filter((s) => buyers.some((b) => b.sectors.some((x) => x.id === s.id)));
  const submitted = !!seller.prefSubmittedAt;
  const needProfile = !submitted && !state.prefsFrozen && !seller.profileCompletedAt;
  const canPick = !submitted && !state.prefsFrozen && !needProfile;

  return (
    <>
      {header}
      {submitted && (
        <Card className="mb-6">
          <CardHeader title="Your submitted preferences" subtitle={`Submitted ${fmtDateTime(seller.prefSubmittedAt)} · cannot be changed`} icon={<Lock className="size-4" />} />
          <ol className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-5">
            {seller.preferences.map((p) => (
              <li key={p.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <Badge tone="violet">#{p.rank}</Badge>
                <div className="mt-1.5 font-semibold text-ink">{p.buyer.name}</div>
                <div className="text-xs text-slate-500">{p.buyer.country}</div>
              </li>
            ))}
          </ol>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Preferences are tentative: the Directorate considers them with other conditions. Your final buyer meetings will be shown on your dashboard once published.
          </p>
        </Card>
      )}
      {!submitted && state.prefsFrozen && (
        <Alert tone="slate" className="mb-6" title="The preference window is closed">
          <span className="inline-flex items-center gap-1"><Snowflake className="size-4" /> The Directorate has frozen preferences. You can still see the buyers; your meetings will be shown once the mapping is published.</span>
        </Alert>
      )}
      {needProfile && (
        <Alert tone="amber" className="mb-6" title="Complete your profile to choose preferences">
          You can see the buyers now. To choose your preferences, first complete your seller profile —{" "}
          <Link href="/seller/profile" className="font-semibold underline">go to My profile</Link>.
        </Alert>
      )}
      {buyers.length
        ? <BuyerDirectory buyers={buyers} canPick={canPick} sectors={usedSectors} />
        : <Card><EmptyState icon={<EyeOff className="size-5" />} title="No approved buyers yet" /></Card>}
    </>
  );
}
