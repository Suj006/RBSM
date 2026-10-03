"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { mapPairAction } from "@/app/actions/matchmaking";
import { Alert, Button, Select } from "@/components/ui";

/** Add any approved seller to a buyer by hand. */
export function AddSellerForm({ buyerId, sellers }: { buyerId: string; sellers: { id: string; label: string }[] }) {
  const [state, run, pending] = useActionState(mapPairAction, undefined);
  return (
    <form action={run} className="space-y-2">
      <input type="hidden" name="op" value="add" />
      <input type="hidden" name="buyerId" value={buyerId} />
      <label htmlFor="add-seller" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add any approved seller manually</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select id="add-seller" name="sellerId" defaultValue="" required className="sm:flex-1">
          <option value="" disabled>Choose a seller…</option>
          {sellers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <Button type="submit" disabled={pending}><Plus className="size-4" /> Add to this buyer</Button>
      </div>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
    </form>
  );
}
