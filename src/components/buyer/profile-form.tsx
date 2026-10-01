"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { saveProfileAction } from "@/app/actions/buyer";
import { Alert, Button, Card, CardHeader, Field, Select, Textarea } from "@/components/ui";
import { ENGAGEMENT_TYPES, ORGANISATION_TYPES, SOURCING_TIMELINES, SOURCING_VALUES } from "@/lib/config";
import { useKeepForm } from "@/lib/use-keep-form";

export type Profile = { organisationType: string; procurementInterests: string; annualSourcingValue: string; sourcingTimeline: string; preferredEngagement: string };

export function ProfileForm({ profile, complete }: { profile: Profile; complete: boolean }) {
  const [state, action, pending] = useActionState(saveProfileAction, undefined);
  const onSubmit = useKeepForm(action);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader title="Sourcing profile" subtitle={complete
        ? "Applies to all your sectors. Please write all details in English."
        : "Complete this once before submitting sectors. Please write all details in English."} />
      <form onSubmit={onSubmit} className="space-y-5 p-6">
        {state?.error && <Alert tone="red">{state.error}</Alert>}
        {state?.ok && <Alert tone="green">{state.message}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Organisation type" htmlFor="organisationType" required error={fe.organisationType}>
            <Select id="organisationType" name="organisationType" defaultValue={profile.organisationType}>
              <option value="">Select…</option>
              {ORGANISATION_TYPES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Indicative annual sourcing value" htmlFor="annualSourcingValue" required error={fe.annualSourcingValue}>
            <Select id="annualSourcingValue" name="annualSourcingValue" defaultValue={profile.annualSourcingValue}>
              <option value="">Select…</option>
              {SOURCING_VALUES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Sourcing timeline" htmlFor="sourcingTimeline" required error={fe.sourcingTimeline}>
            <Select id="sourcingTimeline" name="sourcingTimeline" defaultValue={profile.sourcingTimeline}>
              <option value="">Select…</option>
              {SOURCING_TIMELINES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Preferred engagement" htmlFor="preferredEngagement" error={fe.preferredEngagement}>
            <Select id="preferredEngagement" name="preferredEngagement" defaultValue={profile.preferredEngagement}>
              <option value="">Select…</option>
              {ENGAGEMENT_TYPES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Procurement interests" htmlFor="procurementInterests" required error={fe.procurementInterests} className="sm:col-span-2"
            hint="What you are looking to source, target price points, quality expectations, markets you supply to…">
            <Textarea id="procurementInterests" name="procurementInterests" rows={4} maxLength={3000} defaultValue={profile.procurementInterests} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={pending}><Save className="size-4" /> {pending ? "Saving…" : "Save profile"}</Button>
        </div>
      </form>
    </Card>
  );
}
