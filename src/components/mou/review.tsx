"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ShieldCheck, Undo2 } from "lucide-react";
import { reviewMouAction } from "@/app/actions/mou";
import { Alert, Button, Textarea } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";

/** Verify (nodal officer / Directorate), approve (FIEO), or return to the buyer with a comment. */
export function MouReview({ mouId, can }: { mouId: string; can: { verify: boolean; approve: boolean; ret: boolean } }) {
  const [state, action, pending] = useActionState(reviewMouAction, undefined);
  const onSubmit = useKeepForm(action);
  const [returning, setReturning] = useState(false);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="mouId" value={mouId} />
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
      {!state?.ok && (
        <>
          <div className="flex flex-wrap gap-2">
            {can.verify && <Button type="submit" name="op" value="verify" disabled={pending}><ShieldCheck className="size-4" /> Verify</Button>}
            {can.approve && <Button type="submit" name="op" value="approve" disabled={pending}><CheckCircle2 className="size-4" /> Approve</Button>}
            {can.ret && !returning && <Button type="button" variant="ghost" onClick={() => setReturning(true)}><Undo2 className="size-4" /> Return to buyer</Button>}
          </div>
          {returning && (
            <div className="space-y-2">
              <Textarea name="comment" rows={3} maxLength={1000} placeholder="What should the buyer correct?" aria-label="Comment" />
              {state?.fieldErrors?.comment && <p className="text-xs font-medium text-tx-red">{state.fieldErrors.comment}</p>}
              <div className="flex gap-2">
                <Button type="submit" name="op" value="return" variant="danger" disabled={pending}>Return to buyer</Button>
                <Button type="button" variant="ghost" onClick={() => setReturning(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </>
      )}
    </form>
  );
}
