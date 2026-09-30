import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FIEO_ACTIONABLE } from "@/lib/status";

export default async function FieoLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("FIEO");
  const pending = await prisma.buyer.count({ where: { status: { in: FIEO_ACTIONABLE } } });
  return (
    <AppShell role="FIEO" user={user} nav={[
      { href: "/fieo", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/fieo/buyers", label: "Buyer applications", icon: "buyers", badge: pending },
      { href: "/fieo/approved", label: "RBSM buyer list", icon: "approved" },
    ]}>{children}</AppShell>
  );
}
