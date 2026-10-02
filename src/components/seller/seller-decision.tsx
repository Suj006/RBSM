"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Send, Undo2, XCircle } from "lucide-react";
import { sellerDecisionAction } from "@/app/actions/seller";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";

type Opt = { decision: "recommend" | "approve" | "return" | "reject"; label: string; variant: "primary" | "success" | "danger" | "secondary"; needsComment: boolean };

export const DISTRICT_OPTIONS: Opt[] = [
  { decision: "recommend", label: "Recommend to Directorate", variant: "primary", needsComment: false },
  { decision: "reject", label: "Reject", variant: "secondary", needsComment: true },
];
export const DIRECTORATE_OPTIONS: Opt[] = [
  { decision: "approve", label: "Approve & allot login", variant: "success", needsComment: false },
  { decision: "return", label: "Return to district", variant: "danger", needsComment: true },
  { decision: "reject", label: "Reject", variant: "secondary", needsComment: true },
];

const ICON = { recommend: Send, approve: CheckCircle2, return: Undo2, reject: XCircle };

/** Decision panel for one seller (detail page). */
export function SellerDecision({ sellerId, options, heading, note }: { sellerId: string; options: Opt[]; heading: string; note?: string }) {
  const [state, action, pending] = useActionState(sellerDecisionAction, undefined);
  const onSubmit = useKeepForm(action);
  const [comment, setComment] = useState("");
  if (state?.ok) return <Alert tone="green" title="Done">{state.message}</Alert>;
  if (!options.length) return <div><div className="font-bold text-ink">{heading}</div>{note && <p className="mt-1 text-sm text-slate-500">{note}</p>}</div>;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="sellerIds" value={sellerId} />
      <div>
        <div className="font-bold text-ink">{heading}</div>
        {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      </div>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      <Field label="Comment" htmlFor="comment" error={state?.fieldErrors?.comment} hint="Required when returning or rejecting.">
        <Textarea id="comment" name="comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const Icon = ICON[o.decision];
          return (
            <Button key={o.decision} type="submit" name="decision" value={o.decision} variant={o.variant} disabled={pending}
              onClick={(e) => {
                if (o.needsComment && comment.trim().length < 5) { e.preventDefault(); alert("Please enter a comment (at least 5 characters)."); return; }
                if (o.decision === "approve" && !confirm("Approve this seller and e-mail the login credentials?")) e.preventDefault();
              }}>
              <Icon className="size-4" /> {o.label}
            </Button>
          );
        })}
      </div>
    </form>
  );
}
