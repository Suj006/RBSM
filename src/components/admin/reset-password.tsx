"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { resetBuyerPasswordAction, setStaffPasswordAction } from "@/app/actions/admin";
import { Alert, Button, Input } from "@/components/ui";

export function ResetBuyerPassword({ buyerId }: { buyerId: string }) {
  const [state, action, pending] = useActionState(resetBuyerPasswordAction, undefined);
  return (
    <form action={action} className="space-y-3" onSubmit={(e) => { if (!confirm("Reset this buyer's password to the default and e-mail it?")) e.preventDefault(); }}>
      <input type="hidden" name="buyerId" value={buyerId} />
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      <Button type="submit" variant="secondary" disabled={pending} className="w-full"><KeyRound className="size-4" /> Reset buyer password</Button>
    </form>
  );
}

export function StaffPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(setStaffPasswordAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="userId" value={userId} />
      <div>
        <Input name="password" type="password" placeholder="New password" minLength={6} required aria-label="New password" className="w-44" />
        {state?.fieldErrors?.password && <p className="mt-1 text-xs text-tx-red">{state.fieldErrors.password}</p>}
        {state?.ok && <p className="mt-1 text-xs text-brand-700">{state.message}</p>}
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>Set</Button>
    </form>
  );
}
