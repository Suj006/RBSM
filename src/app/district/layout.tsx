import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DistrictLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("DISTRICT");
  const pending = await prisma.seller.count({ where: { district: user.district ?? "", status: { in: ["WITH_DISTRICT", "RETURNED"] } } });
  return (
    <AppShell role="DISTRICT" user={{ displayName: user.displayName, username: user.username }} nav={[
      { href: "/district", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/district/sellers", label: "Sellers", icon: "sellers", badge: pending },
      { href: "/district/sellers/new", label: "Add seller", icon: "add", exact: true },
      { href: "/district/upload", label: "Bulk upload", icon: "upload" },
      { href: "/district/reports", label: "Reports", icon: "reports" },
    ]}>{children}</AppShell>
  );
}
