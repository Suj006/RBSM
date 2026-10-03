import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("ADMIN");
  return (
    <AppShell role="ADMIN" user={user} nav={[
      { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/admin/buyers", label: "All buyers", icon: "buyers" },
      { href: "/admin/requirements", label: "Sector requirements", icon: "requirement" },
      { href: "/admin/approved", label: "RBSM buyer list", icon: "approved" },
      { href: "/admin/sellers", label: "All sellers", icon: "sellers" },
      { href: "/admin/seller-list", label: "RBSM seller list", icon: "approved" },
      { href: "/admin/demand", label: "Sector demand", icon: "demand" },
      { href: "/admin/targets", label: "Targets", icon: "target" },
      { href: "/admin/reports", label: "Reports", icon: "reports" },
      { href: "/admin/sectors", label: "Sector master", icon: "sectors" },
      { href: "/admin/certifications", label: "Certification master", icon: "certs" },
      { href: "/admin/users", label: "Users & logins", icon: "users" },
      { href: "/admin/emails", label: "E-mail outbox", icon: "mail" },
    ]}>{children}</AppShell>
  );
}
