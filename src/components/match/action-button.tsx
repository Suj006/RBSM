"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import type { FormState } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

type Action = (s: FormState, f: FormData) => Promise<FormState>;

/** A one-click server action with optional confirmation; shows the outcome under the button. */
export function ActionButton({ action, fields, label, confirm, variant = "secondary", className, compact }: {
  action: Action; fields: Record<string, string>; label: React.ReactNode; confirm?: string;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost"; className?: string; compact?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className={cn("space-y-2", className)}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Button type="submit" variant={variant} disabled={pending} className={compact ? "px-3 py-1.5 text-xs" : undefined}>
        {pending ? "Working…" : label}
      </Button>
      {!compact && state?.error && <Alert tone="red">{state.error}</Alert>}
      {!compact && state?.ok && <Alert tone="green">{state.message}</Alert>}
      {compact && state?.error && <p className="text-xs font-medium text-tx-red">{state.error}</p>}
    </form>
  );
}
