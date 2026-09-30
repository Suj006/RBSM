import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/status";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : ROLE_HOME[user.role]);
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Sign in</h1>
      <p className="mb-8 mt-2 text-sm text-slate-500">Buyers, FIEO, Directorate and administrators sign in here.</p>
      <LoginForm />
    </>
  );
}
