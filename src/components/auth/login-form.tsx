"use client";

import { useKeepForm } from "@/lib/use-keep-form";
import { useActionState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const onSubmit = useKeepForm(action);
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      <Field label="User name" htmlFor="username" hint="Buyers: Tradex2027-001 · Sellers: Tradex2027-S001 · District offices: dic-tvm">
        <Input id="username" name="username" autoComplete="username" required autoFocus defaultValue={state?.data?.username} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        <LogIn className="size-4" /> {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-slate-500">
        New international buyer?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">Register for the event</Link>
        <br />
        Kerala MSME seller?{" "}
        <Link href="/seller-register" className="font-semibold text-brand-700 hover:underline">Register as a seller</Link>
      </p>
    </form>
  );
}
