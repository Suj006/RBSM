"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Save, Send, Trash2 } from "lucide-react";
import { applicantSaveSellerAction, saveSellerAction, selfRegisterSellerAction } from "@/app/actions/seller";
import { Alert, Button, ButtonLink, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { DISTRICT_NAMES, LOCAL_BODY_TYPES } from "@/lib/config";
import { useKeepForm } from "@/lib/use-keep-form";
import { UdyamInput } from "./udyam-input";
import { cn } from "@/lib/cn";
import { EMPTY_SELLER, type SellerFormValues } from "@/lib/seller-form-defaults";

export function SellerForm({ mode, initial, sectors, district, backHref }: {
  /** district: a district office; self: public self-registration; applicant: the applicant correcting their own registration. */
  mode: "district" | "self" | "applicant";
  initial: SellerFormValues;
  sectors: { id: string; name: string }[];
  district?: string;
  backHref?: string;
}) {
  const [state, action, pending] = useActionState(mode === "self" ? selfRegisterSellerAction : mode === "applicant" ? applicantSaveSellerAction : saveSellerAction, undefined);
  const onSubmit = useKeepForm(action);
  const [rows, setRows] = useState(initial.products.length ? initial.products : EMPTY_SELLER.products);
  const [same, setSame] = useState(!initial.contactWhatsapp || initial.contactWhatsapp === initial.contactMobile);
  const fe = state?.fieldErrors ?? {};
  const used = new Set(rows.map((r) => r.sectorId));

  if (state?.ok && mode === "self" && state.data) {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700"><CheckCircle2 className="size-6" /></div>
          <div>
            <h2 className="text-2xl font-extrabold text-ink">Registration received</h2>
            <p className="text-sm text-slate-500">Registration no. <span className="font-semibold text-ink">{state.data.regNo}</span></p>
          </div>
        </div>
        <Alert tone="green" className="mt-6">
          Your details have been sent to the District Industries Centre, {state.data.district}, for verification.
        </Alert>
        <div className="mt-4 rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <div className="font-bold text-ink">Your temporary login</div>
          <p className="mt-1 text-sm text-slate-600">
            User name <span className="font-mono font-semibold text-ink">{state.data.username}</span> — the password has been e-mailed to {state.data.email}.
            Use it to track your application and to correct your details if the district centre asks. Once the Directorate approves
            your registration, the same login becomes your permanent seller login.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/login">Sign in to track your application</ButtonLink>
          <ButtonLink href="/" variant="secondary">Back to home</ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="products" value={JSON.stringify(rows)} />
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && mode === "district" && (
        <Alert tone="green" title="Saved">
          {state.message}{" "}
          {state.data?.id && <Link href={`/district/sellers/${state.data.id}`} className="font-semibold underline">Open seller</Link>}
        </Alert>
      )}

      <Card>
        <CardHeader title="Enterprise details" subtitle="Please write all details in English." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Name of the seller" htmlFor="name" required error={fe.name} className="sm:col-span-2" hint="Name of the enterprise as in the Udyam certificate">
            <Input id="name" name="name" defaultValue={initial.name} maxLength={160} />
          </Field>
          <Field label="District" htmlFor="district" required error={fe.district}>
            {mode === "district" ? (
              <>
                <Input id="district" value={district} disabled />
                <input type="hidden" name="district" value={district} />
              </>
            ) : (
              <Select id="district" name="district" defaultValue={initial.district}>
                <option value="">Select district…</option>
                {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Taluk" htmlFor="taluk" required error={fe.taluk}>
            <Input id="taluk" name="taluk" defaultValue={initial.taluk} maxLength={80} />
          </Field>
          <Field label="Local body type" htmlFor="localBodyType" required error={fe.localBodyType}>
            <Select id="localBodyType" name="localBodyType" defaultValue={initial.localBodyType}>
              <option value="">Select…</option>
              {LOCAL_BODY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Local body name" htmlFor="localBodyName" required error={fe.localBodyName}>
            <Input id="localBodyName" name="localBodyName" defaultValue={initial.localBodyName} maxLength={80} />
          </Field>
          <Field label="Udyam registration number" htmlFor="udyamNo" required error={fe.udyamNo} hint="Enter only the numbers — e.g. 07 and 0012345. UDYAM-KL- is filled in for you.">
            <UdyamInput name="udyamNo" defaultValue={initial.udyamNo} invalid={!!fe.udyamNo} />
          </Field>
          <Field label="Export experience" required error={fe.exportExperience}>
            <div className="flex gap-3 pt-1" role="radiogroup">
              {(["YES", "NO"] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ring-1 ring-slate-300 has-[:checked]:bg-brand-50 has-[:checked]:ring-2 has-[:checked]:ring-brand-600">
                  <input type="radio" name="exportExperience" value={v} defaultChecked={initial.exportExperience === v} className="accent-brand-700" />
                  {v === "YES" ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Promoter / contact person" />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Name" htmlFor="contactName" required error={fe.contactName} hint="English letters and spaces only">
            <Input id="contactName" name="contactName" defaultValue={initial.contactName} maxLength={120} autoComplete="name" />
          </Field>
          <Field label="E-mail ID" htmlFor="contactEmail" required error={fe.contactEmail}
            hint={mode === "district" ? "Login credentials are sent here after approval" : "Login details and updates on your application are sent here"}>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={initial.contactEmail} maxLength={160} autoComplete="email" />
          </Field>
          <Field label="Mobile number" htmlFor="contactMobile" required error={fe.contactMobile} hint="10-digit mobile number">
            <Input id="contactMobile" name="contactMobile" type="tel" inputMode="numeric" defaultValue={initial.contactMobile} maxLength={16} placeholder="98765 43210" />
          </Field>
          <Field label="WhatsApp number" htmlFor="contactWhatsapp" required error={fe.contactWhatsapp}>
            <div className="space-y-2">
              <Input id="contactWhatsapp" name="contactWhatsapp" type="tel" inputMode="numeric" defaultValue={same ? "" : initial.contactWhatsapp}
                maxLength={16} disabled={same} placeholder={same ? "Same as mobile number" : "98765 43210"} />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="sameWhatsapp" checked={same} onChange={(e) => setSame(e.target.checked)} className="accent-brand-700" />
                Same as mobile number
              </label>
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Sectors & products ready to export" subtitle="Add each sector the enterprise works in, with the products it can export now."
          action={
            <Button type="button" variant="secondary" disabled={rows.length >= sectors.length} onClick={() => setRows((r) => [...r, { sectorId: "", products: "" }])}>
              <Plus className="size-4" /> Add sector
            </Button>
          } />
        {fe.products && <Alert tone="red" className="mx-6 mt-5">{fe.products}</Alert>}
        <div className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-4 p-6 sm:grid-cols-[minmax(0,280px)_1fr_auto] sm:items-start">
              <Field label={`Sector ${i + 1}`} htmlFor={`sector-${i}`} required error={fe[`products.${i}.sectorId`]}>
                <Select id={`sector-${i}`} value={r.sectorId} onChange={(e) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, sectorId: e.target.value } : x)))}>
                  <option value="">Select sector…</option>
                  {sectors.filter((s) => s.id === r.sectorId || !used.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Products ready to export" htmlFor={`products-${i}`} required error={fe[`products.${i}.products`]} hint="Separate products with commas">
                <Textarea id={`products-${i}`} rows={2} maxLength={1000} value={r.products} placeholder="e.g. Black pepper, Cardamom"
                  onChange={(e) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, products: e.target.value } : x)))} />
              </Field>
              <button type="button" onClick={() => setRows((xs) => xs.filter((_, j) => j !== i))} disabled={rows.length === 1}
                className={cn("mt-7 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-tx-red hover:bg-red-50", rows.length === 1 && "invisible")}
                aria-label={`Remove sector ${i + 1}`}>
                <Trash2 className="size-3.5" /> Remove
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {backHref && <ButtonLink href={backHref} variant="ghost">Cancel</ButtonLink>}
        {mode === "district" ? (
          <>
            <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}><Save className="size-4" /> Save</Button>
            <Button type="submit" name="intent" value="recommend" disabled={pending}><Send className="size-4" /> {pending ? "Saving…" : "Save & recommend to Directorate"}</Button>
          </>
        ) : mode === "applicant" ? (
          <Button type="submit" disabled={pending} className="px-6"><Send className="size-4" /> {pending ? "Submitting…" : "Save & submit to district centre"}</Button>
        ) : (
          <Button type="submit" disabled={pending} className="px-6"><Send className="size-4" /> {pending ? "Submitting…" : "Submit registration"}</Button>
        )}
      </div>
    </form>
  );
}
