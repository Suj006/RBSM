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
      { href: "/fieo/buyers", label: "Buyer applications", icon: "buyers", badge: pending },
      { href: "/fieo/requirements", label: "Sector requirements", icon: "requirement" },
      { href: "/fieo/approved", label: "RBSM buyer list", icon: "approved" },
      { href: "/fieo/sellers", label: "Approved sellers", icon: "sellers" },
      { href: "/fieo/demand", label: "Sector demand", icon: "demand" },
      { href: "/fieo/reports", label: "Reports", icon: "reports" },
    ]}>{children}</AppShell>
  );
}
