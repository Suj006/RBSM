"use client";

import { useActionState, useState } from "react";
import { Megaphone } from "lucide-react";
import { sendAnnouncementAction } from "@/app/actions/comms";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";
import { DocRows } from "./doc-rows";

type Opt = { value: string; label: string };

/** A common communication. Staff choose the audience; a buyer writes to all its matched sellers. */
export function AnnouncementForm({ audiences, sectors, districts, recipientsNote }: {
  audiences?: Opt[]; sectors?: Opt[]; districts?: string[]; recipientsNote?: string;
}) {
  const [state, run, pending] = useActionState(sendAnnouncementAction, undefined);
  const onSubmit = useKeepForm(run);
  const [audience, setAudience] = useState("");
  const fe = state?.fieldErrors ?? {};
  const staff = !!audiences;
  const sellersIn = ["ALL_PARTICIPANTS", "APPROVED_SELLERS", "MATCHED"].includes(audience);
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {staff ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Send to" htmlFor="audience" required error={fe.audience} className="sm:col-span-3">
            <Select id="audience" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="">Choose recipients…</option>
              {audiences!.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
          </Field>
          {audience && audience !== "ALL_BUYERS" && (
            <Field label="Only in sector (optional)" htmlFor="sectorId" hint="Approved buyers / sellers of this sector">
              <Select id="sectorId" name="sectorId" defaultValue="">
                <option value="">All sectors</option>
                {sectors!.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
          )}
          {sellersIn && (
            <Field label="Only sellers of district (optional)" htmlFor="district" error={fe.district} hint="Leaves out buyers">
              <Select id="district" name="district" defaultValue="">
                <option value="">All districts</option>
                {districts!.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
          )}
        </div>
      ) : recipientsNote ? <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">{recipientsNote}</p> : null}
      <Field label="Subject" htmlFor="subject" required error={fe.subject}>
        <Input id="subject" name="subject" maxLength={160} />
      </Field>
      <Field label="Message" htmlFor="ann-body" required error={fe.body}>
        <Textarea id="ann-body" name="body" rows={6} maxLength={8000} />
      </Field>
      <DocRows errors={fe} resetKey={0} />
      {staff && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="email" defaultChecked className="accent-brand-700" /> Also e-mail each recipient that a communication is waiting
        </label>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}><Megaphone className="size-4" /> {pending ? "Sending…" : "Send communication"}</Button>
      </div>
    </form>
  );
}
