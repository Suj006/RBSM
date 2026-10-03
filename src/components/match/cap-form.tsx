"use client";

import { useActionState } from "react";
import { matchControlAction } from "@/app/actions/matchmaking";
import { Button, Input } from "@/components/ui";

/** Buyers per seller limit (0 = automatic). */
export function CapForm({ current, auto }: { current: number; auto: number }) {
  const [state, run, pending] = useActionState(matchControlAction, undefined);
  return (
    <form action={run} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <input type="hidden" name="op" value="setCap" />
      <label htmlFor="cap">Max buyers per seller</label>
      <div className="w-20"><Input id="cap" name="cap" type="number" min={0} max={100} defaultValue={current} className="h-8 py-1 text-sm" /></div>
      <span>{current ? "" : `(0 = automatic, now ${auto})`}</span>
      <Button type="submit" variant="secondary" disabled={pending} className="px-3 py-1.5 text-xs">Save</Button>
      {state?.fieldErrors?.cap && <span className="text-tx-red">{state.fieldErrors.cap}</span>}
      {state?.ok && <span className="text-brand-700">{state.message}</span>}
    </form>
  );
}
