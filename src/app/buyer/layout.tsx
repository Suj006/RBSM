import { AppShell } from "@/components/shell/app-shell";
import { requireBuyer } from "@/lib/auth";
import { unreadTotal } from "@/lib/comms";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireBuyer();
  const unread = await unreadTotal(user);
  return (
    <AppShell
      role="BUYER"
      user={user}
      nav={[
        { href: "/buyer", label: "Dashboard", icon: "dashboard", exact: true },
        { href: "/buyer/profile", label: "Basic details", icon: "profile" },
        { href: "/buyer/requirement", label: "Detailed requirement", icon: "requirement" },
        { href: "/buyer/matches", label: "Matched sellers", icon: "sellers" },
        { href: "/buyer/messages", label: "Messages", icon: "messages", badge: unread },
      ]}
    >
      {children}
    </AppShell>
  );
}
