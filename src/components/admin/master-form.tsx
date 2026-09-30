"use client";

import { useKeepForm } from "@/lib/use-keep-form";
import { useActionState, useEffect, useRef } from "react";
import { Plus, Save } from "lucide-react";
import { saveMasterAction } from "@/app/actions/admin";
import { Alert, Button, Input } from "@/components/ui";

export function MasterForm({ kind, item, withOrder }: {
  kind: "sector" | "certification";
  item?: { id: string; name: string; description: string | null; sortOrder?: number };
  withOrder?: boolean;
}) {
  const [state, action, pending] = useActionState(saveMasterAction, undefined);
  const onSubmit = useKeepForm(action);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && !item) ref.current?.reset(); }, [state, item]);
  const fe = state?.fieldErrors ?? {};
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className={withOrder ? "grid gap-2 sm:grid-cols-[1fr_1.4fr_90px_auto]" : "grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"}>
        <Input name="name" defaultValue={item?.name} placeholder="Name" required maxLength={120} aria-label="Name" aria-invalid={!!fe.name} />
        <Input name="description" defaultValue={item?.description ?? ""} placeholder="Description (optional)" maxLength={500} aria-label="Description" />
        {withOrder && <Input name="sortOrder" type="number" min={0} defaultValue={item?.sortOrder ?? 0} aria-label="Display order" title="Display order" />}
        <Button type="submit" variant={item ? "secondary" : "primary"} disabled={pending}>
          {item ? <><Save className="size-4" /> Save</> : <><Plus className="size-4" /> Add</>}
        </Button>
      </div>
      {fe.name && <p className="text-xs font-medium text-tx-red">{fe.name}</p>}
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && !item && <p className="text-xs font-medium text-brand-700">{state.message}</p>}
    </form>
  );
}
