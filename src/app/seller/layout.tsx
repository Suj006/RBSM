import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("SELLER");
  const seller = await prisma.seller.findUnique({ where: { userId: user.id }, select: { status: true, profileCompletedAt: true } });
  return (
    <AppShell role="SELLER" user={{ displayName: user.displayName, username: user.username }} nav={[
      { href: "/seller", label: seller?.status === "APPROVED" ? "Dashboard" : "My application", icon: "dashboard", exact: true },
      ...(seller?.status === "APPROVED" ? [
        { href: "/seller/profile", label: "My profile", icon: "profile" as const, badge: seller.profileCompletedAt ? undefined : 1 },
        { href: "/seller/buyers", label: "Buyers & preferences", icon: "buyers" as const },
      ] : []),
    ]}>{children}</AppShell>
  );
}
