import { AppShell } from "@/components/shell/app-shell";
import { requireBuyer } from "@/lib/auth";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireBuyer();
  return (
    <AppShell
      role="BUYER"
      user={user}
      nav={[
        { href: "/buyer", label: "Dashboard", icon: "dashboard", exact: true },
        { href: "/buyer/profile", label: "Basic details", icon: "profile" },
        { href: "/buyer/requirement", label: "Detailed requirement", icon: "requirement" },
      ]}
    >
      {children}
    </AppShell>
  );
}
