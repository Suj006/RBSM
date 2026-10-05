import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";

export default async function NodalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("NODAL");
  return (
    <AppShell role="NODAL" user={user} nav={[
      { href: "/nodal", label: "My buyers' meetings", icon: "match", exact: true },
      { href: "/nodal/verify", label: "Verify ticket / seller ID", icon: "checks" },
    ]}>{children}</AppShell>
  );
}
