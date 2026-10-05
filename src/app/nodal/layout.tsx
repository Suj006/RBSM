import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NodalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("NODAL");
  const mous = await prisma.mou.count({ where: { status: "SUBMITTED", nodalVerifiedAt: null, buyer: { nodalOfficer: { userId: user.id } } } });
  return (
    <AppShell role="NODAL" user={user} nav={[
      { href: "/nodal", label: "My buyers' meetings", icon: "match", exact: true },
      { href: "/nodal/verify", label: "Verify ticket / seller ID", icon: "checks" },
      { href: "/nodal/mou", label: "MoUs to verify", icon: "mou", badge: mous },
    ]}>{children}</AppShell>
  );
}
