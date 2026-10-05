import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { unreadTotal } from "@/lib/comms";
import { prisma } from "@/lib/prisma";
import { actionWhere } from "@/lib/buyer-query";

export default async function FieoLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("FIEO");
  const [pending, unread, mous] = await Promise.all([prisma.buyer.count({ where: actionWhere("FIEO") }), unreadTotal(user),
    prisma.mou.count({ where: { status: "SUBMITTED", fieoApprovedAt: null } })]);
  return (
    <AppShell role="FIEO" user={user} nav={[
      { href: "/fieo", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/fieo/find", label: "Find by ID", icon: "find" },
      { href: "/fieo/buyers", label: "Buyer applications", icon: "buyers", badge: pending, group: "Buyers" },
      { href: "/fieo/buyers/new", label: "Add buyer", icon: "add", exact: true, group: "Buyers" },
      { href: "/fieo/buyers/upload", label: "Bulk upload buyers", icon: "upload", group: "Buyers" },
      { href: "/fieo/requirements", label: "Sector requirements", icon: "requirement", group: "Buyers" },
      { href: "/fieo/approved", label: "RBSM buyer list", icon: "approved", group: "Buyers" },
      { href: "/fieo/seller-list", label: "RBSM seller list", icon: "sellers", group: "Sellers" },
      { href: "/fieo/demand", label: "Sector demand", icon: "demand", group: "Programme" },
      { href: "/fieo/products", label: "Product demand", icon: "products", group: "Programme" },
      { href: "/fieo/matches", label: "Buyer–seller mapping", icon: "match", group: "Programme" },
      { href: "/fieo/event", label: "Event day monitor", icon: "calendar", group: "Programme" },
      { href: "/fieo/mou", label: "MoU dashboard", icon: "mou", badge: mous, group: "Programme" },
      { href: "/fieo/reports", label: "Reports", icon: "reports", group: "Programme" },
      { href: "/fieo/messages", label: "Messages", icon: "messages", badge: unread, group: "Communications" },
    ]}>{children}</AppShell>
  );
}
