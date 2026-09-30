"use client";

import { useKeepForm } from "@/lib/use-keep-form";
import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { changePasswordAction } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  const onSubmit = useKeepForm(action);
  const fe = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Current password" htmlFor="current" required error={fe.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="next" required error={fe.next} hint="At least 8 characters, with a letter and a number.">
        <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" required error={fe.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        <KeyRound className="size-4" /> {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
