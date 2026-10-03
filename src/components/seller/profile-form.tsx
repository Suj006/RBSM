"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { saveSellerProfileAction } from "@/app/actions/seller";
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { CONSTITUTIONS, GENDERS, SOCIAL_CATEGORIES, UNIT_CATEGORIES, UNIT_TYPES } from "@/lib/config";
import { BLOCKS } from "@/lib/kerala";
import { useKeepForm } from "@/lib/use-keep-form";
import { CertPicker } from "./cert-picker";
import { CountryMulti } from "./country-multi";

export type ProfileValues = {
  promoterGender: string; promoterDob: string; socialCategory: string; speciallyAbled: "" | "YES" | "NO";
  block: string; constitution: string; unitCategory: string; unitType: string; iecNo: string; certifications: string[];
  exportCountries: string[]; exportedProducts: string;
};
export type ProfileFixed = {
  contactName: string; contactMobile: string; contactEmail: string; name: string; udyamNo: string; district: string; taluk: string;
  localBody: string; exportExperience: boolean;
};

function Choice({ name, options, value }: { name: string; options: readonly { value: string; label: string }[]; value: string }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1" role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium ring-1 ring-slate-300 has-[:checked]:bg-brand-50 has-[:checked]:ring-2 has-[:checked]:ring-brand-600">
          <input type="radio" name={name} value={o.value} defaultChecked={value === o.value} className="accent-brand-700" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

const Fixed = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <Field label={label} className={className}>
    <div className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200">{value || "—"}</div>
  </Field>
);

/** The profile an approved seller completes: promoter and unit details missing from registration. */
export function SellerProfileForm({ initial, fixed, certifications, first }: {
  initial: ProfileValues; fixed: ProfileFixed; certifications: string[]; first: boolean;
}) {
  const [state, action, pending] = useActionState(saveSellerProfileAction, undefined);
  const onSubmit = useKeepForm(action);
  const fe = state?.fieldErrors ?? {};
  const blocks = BLOCKS[fixed.district] ?? [];
  const today = new Date();
  const maxDob = `${today.getFullYear() - 18}-12-31`;
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      <Card>
        <CardHeader title="Promoter details" subtitle="Name, mobile and e-mail are from your registration." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Fixed label="Name of the promoter" value={fixed.contactName} />
          <Field label="Gender" required error={fe.promoterGender} className="sm:col-span-2">
            <Choice name="promoterGender" options={GENDERS} value={initial.promoterGender} />
          </Field>
          <Fixed label="Mobile number" value={fixed.contactMobile} />
          <Fixed label="E-mail ID" value={fixed.contactEmail} />
          <Field label="Date of birth" htmlFor="promoterDob" required error={fe.promoterDob}>
            <Input id="promoterDob" name="promoterDob" type="date" defaultValue={initial.promoterDob} max={maxDob} min="1920-01-01" />
          </Field>
          <Field label="Social category" htmlFor="socialCategory" required error={fe.socialCategory}>
            <Select id="socialCategory" name="socialCategory" defaultValue={initial.socialCategory}>
              <option value="">Select…</option>
              {SOCIAL_CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Specially abled" required error={fe.speciallyAbled}>
            <Choice name="speciallyAbled" options={[{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }]} value={initial.speciallyAbled} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Unit details" subtitle="Unit name, Udyam number, district, taluk and local body are from your registration." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Fixed label="Name of the unit" value={fixed.name} className="sm:col-span-2" />
          <Fixed label="Udyam number" value={fixed.udyamNo} />
          <Fixed label="District in which the unit belongs" value={fixed.district} />
          <Fixed label="Taluk" value={fixed.taluk} />
          <Field label="Block" htmlFor="block" required error={fe.block}>
            <Select id="block" name="block" defaultValue={initial.block}>
              <option value="">Select block…</option>
              {blocks.map((b) => <option key={b}>{b}</option>)}
            </Select>
          </Field>
          <Fixed label="Local body" value={fixed.localBody} className="sm:col-span-2" />
          <Field label="Constitution of the unit" htmlFor="constitution" required error={fe.constitution}>
            <Select id="constitution" name="constitution" defaultValue={initial.constitution}>
              <option value="">Select…</option>
              {CONSTITUTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Category of the unit" required error={fe.unitCategory}>
            <Choice name="unitCategory" options={UNIT_CATEGORIES} value={initial.unitCategory} />
          </Field>
          <Field label="Unit type" required error={fe.unitType}>
            <Choice name="unitType" options={UNIT_TYPES} value={initial.unitType} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Export credentials" subtitle={fixed.exportExperience ? "Export history is for reference only; it does not affect matchmaking." : undefined} />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          {fixed.exportExperience && (
            <>
              <Field label="Countries exported to" htmlFor="exportCountries" required error={fe.exportCountries ?? Object.entries(fe).find(([k]) => k.startsWith("exportCountries."))?.[1]}
                hint="Pick each country from the list; you can add several.">
                <CountryMulti id="exportCountries" name="exportCountries" initial={initial.exportCountries} invalid={!!fe.exportCountries} />
              </Field>
              <Field label="Products exported" htmlFor="exportedProducts" required error={fe.exportedProducts} hint="Separate products with commas">
                <Textarea id="exportedProducts" name="exportedProducts" rows={3} maxLength={1000} defaultValue={initial.exportedProducts} />
              </Field>
            </>
          )}
          <Field label="IEC number (Importer-Exporter Code)" htmlFor="iecNo" required={fixed.exportExperience} error={fe.iecNo}
            hint={fixed.exportExperience ? "10 characters, e.g. ABCDE1234F — required as the unit has export experience" : "10 characters, e.g. ABCDE1234F — if the unit has one"}>
            <Input id="iecNo" name="iecNo" defaultValue={initial.iecNo} maxLength={14} className="uppercase" autoComplete="off" />
          </Field>
          <div className="sm:col-span-2">
            <div className="mb-2 text-sm font-semibold text-slate-700">Quality / product certifications held</div>
            <CertPicker name="certifications" master={certifications} initial={initial.certifications}
              error={Object.entries(fe).find(([k]) => k.startsWith("certifications"))?.[1]} />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="px-6"><Save className="size-4" /> {pending ? "Saving…" : first ? "Save and complete profile" : "Save changes"}</Button>
      </div>
    </form>
  );
}
