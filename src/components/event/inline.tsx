"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

type Action = (s: FormState, f: FormData) => Promise<FormState>;

/** A compact inline form (one or two inputs and a Save button) that reports its result next to it. */
export function InlineForm({ action, fields, children, label = "Save", className }: {
  action: Action; fields: Record<string, string>; children: React.ReactNode; label?: string; className?: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className={cn("flex flex-wrap items-center gap-2", className)}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <button type="submit" disabled={pending} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50">{pending ? "…" : label}</button>
      {state?.error && <span className="w-full text-xs font-medium text-tx-red">{state.error}</span>}
      {state?.ok && <span className="text-xs font-medium text-brand-700">✓</span>}
    </form>
  );
}
