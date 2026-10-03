import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionWhere } from "@/lib/buyer-query";

export default async function FieoLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("FIEO");
  const pending = await prisma.buyer.count({ where: actionWhere("FIEO") });
  return (
    <AppShell role="FIEO" user={user} nav={[
      { href: "/fieo", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/fieo/buyers", label: "Buyer applications", icon: "buyers", badge: pending, group: "Buyers" },
      { href: "/fieo/requirements", label: "Sector requirements", icon: "requirement", group: "Buyers" },
      { href: "/fieo/approved", label: "RBSM buyer list", icon: "approved", group: "Buyers" },
      { href: "/fieo/seller-list", label: "RBSM seller list", icon: "sellers", group: "Sellers" },
      { href: "/fieo/demand", label: "Sector demand", icon: "demand", group: "Programme" },
      { href: "/fieo/products", label: "Product demand", icon: "products", group: "Programme" },
      { href: "/fieo/matches", label: "Buyer–seller mapping", icon: "match", group: "Programme" },
      { href: "/fieo/reports", label: "Reports", icon: "reports", group: "Programme" },
    ]}>{children}</AppShell>
  );
}
