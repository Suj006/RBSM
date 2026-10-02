import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { StaffPasswordForm } from "@/components/admin/reset-password";
import { setUserActiveAction } from "@/app/actions/admin";
import { ROLE_LABEL } from "@/lib/status";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Users & logins" };

export default async function Page() {
  const [staff, buyerCount, activeBuyers] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "FIEO", "DIC", "DISTRICT"] } }, orderBy: [{ role: "asc" }, { username: "asc" }] }),
    prisma.user.count({ where: { role: "BUYER" } }),
    prisma.user.count({ where: { role: "BUYER", mustChangePassword: false } }),
  ]);
  return (
    <>
      <PageHeader title="Users & logins" subtitle={`Staff and district office logins. ${buyerCount} buyer accounts (${activeBuyers} have set their own password) — buyer passwords can be reset from each buyer's page.`} />
      <Card>
        <CardHeader title="Staff logins" />
        <ul className="divide-y divide-slate-100">
          {staff.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">{u.username}</span>
                  <Badge tone="blue">{ROLE_LABEL[u.role]}</Badge>
                  {!u.isActive && <Badge tone="red">Disabled</Badge>}
                </div>
                <div className="text-xs text-slate-500">{u.displayName} · last login {fmtDateTime(u.lastLoginAt)}</div>
              </div>
              <StaffPasswordForm userId={u.id} />
              {u.role !== "ADMIN" && (
                <form action={setUserActiveAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="isActive" value={String(!u.isActive)} />
                  <button className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                    {u.isActive ? "Disable" : "Enable"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
