import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ROLE_HOME } from "@/lib/status";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Alert } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser(undefined, { allowPasswordChange: true });
  return (
    <>
      {!user.mustChangePassword && (
        <Link href={ROLE_HOME[user.role]} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
      )}
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Change password</h1>
      <p className="mb-6 mt-2 text-sm text-slate-500">
        Signed in as <span className="font-mono font-semibold text-ink">{user.username}</span>
      </p>
      {user.mustChangePassword && (
        <Alert tone="amber" className="mb-6" title="Please set a new password">
          For your security, the temporary password must be changed before you continue.
        </Alert>
      )}
      <ChangePasswordForm />
      <form action={logoutAction} className="mt-4 text-center">
        <button className="text-sm text-slate-500 hover:text-ink hover:underline">Sign out</button>
      </form>
    </>
  );
}
