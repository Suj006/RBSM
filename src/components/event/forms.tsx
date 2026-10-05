"use client";

import { useActionState, useState } from "react";
import { CalendarRange, Plus, Save, UserPlus, X } from "lucide-react";
import { createNodalAction, saveEventDaysAction, setEventDatesAction } from "@/app/actions/event";
import { Alert, Button, Field, Input } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";

type Break = { label: string; start: string; end: string };
type DayRow = { date: string; label: string; startTime: string; endTime: string; breaks: Break[] };

export function EventDatesForm({ start, end, disabled }: { start: string; end: string; disabled?: boolean }) {
  const [state, run, pending] = useActionState(setEventDatesAction, undefined);
  const onSubmit = useKeepForm(run);
  const fe = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Event starts on" htmlFor="startDate" required error={fe.startDate}><Input id="startDate" name="startDate" type="date" defaultValue={start} disabled={disabled} /></Field>
        <Field label="Event ends on" htmlFor="endDate" required error={fe.endDate}><Input id="endDate" name="endDate" type="date" defaultValue={end} disabled={disabled} /></Field>
        {!disabled && <Button type="submit" disabled={pending}><CalendarRange className="size-4" /> {pending ? "Saving…" : "Save dates"}</Button>}
      </div>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
    </form>
  );
}

function DayEditor({ d, error, disabled }: { d: DayRow; error?: string; disabled?: boolean }) {
  const [n, setN] = useState(Math.max(d.breaks.length, 0));
  const rows = Array.from({ length: n }, (_, i) => d.breaks[i] ?? { label: "", start: "", end: "" });
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="mb-3 font-bold text-ink">{d.label}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Meetings from" htmlFor={`start-${d.date}`}><Input id={`start-${d.date}`} name={`start-${d.date}`} type="time" defaultValue={d.startTime} disabled={disabled} /></Field>
        <Field label="Last meeting ends by" htmlFor={`end-${d.date}`}><Input id={`end-${d.date}`} name={`end-${d.date}`} type="time" defaultValue={d.endTime} disabled={disabled} /></Field>
      </div>
      <div className="mt-3 space-y-2">
        <div className="text-sm font-semibold text-slate-700">Breaks</div>
        {rows.map((b, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center">
            <Input name={`blabel${i}-${d.date}`} defaultValue={b.label} placeholder="e.g. Lunch break" aria-label={`Break ${i + 1} name`} disabled={disabled} />
            <Input name={`bstart${i}-${d.date}`} type="time" defaultValue={b.start} aria-label={`Break ${i + 1} from`} disabled={disabled} />
            <Input name={`bend${i}-${d.date}`} type="time" defaultValue={b.end} aria-label={`Break ${i + 1} to`} disabled={disabled} />
            {!disabled && i === n - 1 && <button type="button" onClick={() => setN(n - 1)} aria-label="Remove break" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-tx-red"><X className="size-4" /></button>}
          </div>
        ))}
        {!n && <p className="text-xs text-slate-500">No breaks.</p>}
        {!disabled && n < 3 && <button type="button" onClick={() => setN(n + 1)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><Plus className="size-4" /> Add a break</button>}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-tx-red">{error}</p>}
    </div>
  );
}

export function EventDaysForm({ days, meetingMinutes, bufferMinutes, venue, disabled }: {
  days: DayRow[]; meetingMinutes: number; bufferMinutes: number; venue: string; disabled?: boolean;
}) {
  const [state, run, pending] = useActionState(saveEventDaysAction, undefined);
  const onSubmit = useKeepForm(run);
  const fe = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Meeting length (minutes)" htmlFor="meetingMinutes" error={fe.meetingMinutes}><Input id="meetingMinutes" name="meetingMinutes" type="number" min={10} max={120} defaultValue={meetingMinutes} disabled={disabled} /></Field>
        <Field label="Buffer after each meeting (minutes)" htmlFor="bufferMinutes" error={fe.bufferMinutes} hint="Time for sellers to move to the next pavilion"><Input id="bufferMinutes" name="bufferMinutes" type="number" min={0} max={60} defaultValue={bufferMinutes} disabled={disabled} /></Field>
        <Field label="Venue" htmlFor="venue" hint="Shown on tickets"><Input id="venue" name="venue" defaultValue={venue} maxLength={200} placeholder="e.g. Grand Hyatt, Kochi" disabled={disabled} /></Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{days.map((d) => <DayEditor key={d.date} d={d} error={fe[`day-${d.date}`]} disabled={disabled} />)}</div>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
      {!disabled && <div className="flex justify-end"><Button type="submit" disabled={pending}><Save className="size-4" /> {pending ? "Saving…" : "Save hours and breaks"}</Button></div>}
    </form>
  );
}

export function NodalForm() {
  const [state, run, pending] = useActionState(createNodalAction, undefined);
  const onSubmit = useKeepForm(run);
  const fe = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate key={state?.ok ? state.message : "form"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name" htmlFor="n-name" required error={fe.name}><Input id="n-name" name="name" maxLength={120} /></Field>
        <Field label="Designation" htmlFor="n-desig" error={fe.designation}><Input id="n-desig" name="designation" maxLength={120} /></Field>
        <Field label="Mobile number" htmlFor="n-mobile" required error={fe.mobile}><Input id="n-mobile" name="mobile" type="tel" maxLength={16} /></Field>
        <Field label="E-mail ID" htmlFor="n-email" required error={fe.email}><Input id="n-email" name="email" type="email" maxLength={160} /></Field>
      </div>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
      <div className="flex justify-end"><Button type="submit" disabled={pending}><UserPlus className="size-4" /> {pending ? "Adding…" : "Add nodal officer"}</Button></div>
    </form>
  );
}
