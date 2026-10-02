import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("SELLER");
  return (
    <AppShell role="SELLER" user={{ displayName: user.displayName, username: user.username }} nav={[
      { href: "/seller", label: "Dashboard", icon: "dashboard", exact: true },
    ]}>{children}</AppShell>
  );
}
