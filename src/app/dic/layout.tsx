import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionWhere } from "@/lib/buyer-query";

export default async function DicLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("DIC");
  const [pending, sellerPending] = await Promise.all([
    prisma.buyer.count({ where: actionWhere("DIC") }),
    prisma.seller.count({ where: { status: "RECOMMENDED" } }),
  ]);
  return (
    <AppShell role="DIC" user={user} nav={[
      { href: "/dic", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/dic/buyers", label: "Buyers", icon: "buyers", badge: pending, group: "Buyers" },
      { href: "/dic/requirements", label: "Sector requirements", icon: "requirement", group: "Buyers" },
      { href: "/dic/approved", label: "RBSM buyer list", icon: "approved", group: "Buyers" },
      { href: "/dic/sellers", label: "Sellers", icon: "sellers", badge: sellerPending, group: "Sellers" },
      { href: "/dic/seller-list", label: "RBSM seller list", icon: "approved", group: "Sellers" },
      { href: "/dic/demand", label: "Sector demand", icon: "demand", group: "Programme" },
      { href: "/dic/products", label: "Product demand", icon: "products", group: "Programme" },
      { href: "/dic/insights", label: "Insights", icon: "insights", group: "Programme" },
      { href: "/dic/targets", label: "Targets", icon: "target", group: "Programme" },
      { href: "/dic/reports", label: "Reports", icon: "reports", group: "Programme" },
      { href: "/dic/matchmaking", label: "Matchmaking", icon: "match", exact: true, group: "Matchmaking" },
      { href: "/dic/matchmaking/board", label: "Mapping board", icon: "board", group: "Matchmaking" },
      { href: "/dic/matchmaking/preferences", label: "Seller preferences", icon: "star", group: "Matchmaking" },
      { href: "/dic/matchmaking/checks", label: "Mapping checks", icon: "checks", group: "Matchmaking" },
      { href: "/dic/matchmaking/results", label: "Results & gaps", icon: "results", group: "Matchmaking" },
      { href: "/dic/matchmaking/published", label: "Published mapping", icon: "approved", group: "Matchmaking" },
    ]}>{children}</AppShell>
  );
}
