"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { sendMessageAction } from "@/app/actions/comms";
import type { FormState } from "@/app/actions/auth";
import { Alert, Button, Textarea } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";
import { DocRows } from "./doc-rows";

type Action = (s: FormState, f: FormData) => Promise<FormState>;

/** Write a message (with named documents). `fields` say where it goes (conversation, pair or desk). */
export function Composer({ fields, placeholder, action = sendMessageAction, submitLabel = "Send", children }: {
  fields: Record<string, string>; placeholder?: string; action?: Action; submitLabel?: string; children?: React.ReactNode;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const onSubmit = useKeepForm(run);
  const ref = useRef<HTMLFormElement>(null);
  // After each successful send: clear the text and the document rows.
  const [sent, setSent] = useState(0);
  const [prev, setPrev] = useState(state);
  if (state !== prev) { setPrev(state); if (state?.ok) setSent((n) => n + 1); }
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  const fe = state?.fieldErrors ?? {};
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3" noValidate>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <div>
        <Textarea name="body" rows={4} maxLength={5000} placeholder={placeholder ?? "Write your message…"} aria-label="Message" aria-invalid={!!fe.body || undefined} />
        {fe.body && <p className="mt-1 text-xs font-medium text-tx-red">{fe.body}</p>}
      </div>
      <DocRows errors={fe} resetKey={sent} />
      {state?.error && !fe.body && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}><Send className="size-4" /> {pending ? "Sending…" : submitLabel}</Button>
      </div>
    </form>
  );
}
