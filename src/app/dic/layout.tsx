import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionWhere } from "@/lib/buyer-query";

export default async function DicLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("DIC");
  const pending = await prisma.buyer.count({ where: actionWhere("DIC") });
  return (
    <AppShell role="DIC" user={user} nav={[
      { href: "/dic", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/dic/buyers", label: "For approval", icon: "review", badge: pending },
      { href: "/dic/approved", label: "RBSM buyer list", icon: "approved" },
      { href: "/dic/reports", label: "Reports", icon: "reports" },
    ]}>{children}</AppShell>
  );
}
