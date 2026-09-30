import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DicLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("DIC");
  const pending = await prisma.buyer.count({ where: { status: "FIEO_RECOMMENDED" } });
  return (
    <AppShell role="DIC" user={user} nav={[
      { href: "/dic", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/dic/buyers", label: "Recommended buyers", icon: "review", badge: pending },
      { href: "/dic/approved", label: "RBSM buyer list", icon: "approved" },
    ]}>{children}</AppShell>
  );
}
