"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileSpreadsheet, KeyRound, Upload, UserPlus } from "lucide-react";
import { addBuyerAction, buyerBulkAction } from "@/app/actions/fieo-buyers";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";
import { COUNTRIES } from "@/lib/countries";
import { ENGAGEMENT_TYPES, ORGANISATION_TYPES, SOURCING_TIMELINES, SOURCING_VALUES } from "@/lib/config";

const SLOTS = 3;

/** FIEO: register one buyer — temporary login e-mailed; basic details count as verified; sectors go to the Directorate. */
export function AddBuyerForm({ sectors, accept }: { sectors: { id: string; name: string }[]; accept: string }) {
  const [key, setKey] = useState(0);
  return <AddBuyerInner key={key} sectors={sectors} accept={accept} onAnother={() => setKey((k) => k + 1)} />;
}

function AddBuyerInner({ sectors, accept, onAnother }: { sectors: { id: string; name: string }[]; accept: string; onAnother: () => void }) {
  const [state, action, pending] = useActionState(addBuyerAction, undefined);
  const onSubmit = useKeepForm(action);
  const fe = state?.fieldErrors ?? {};
  const v = (k: string) => state?.data?.[k] ?? "";

  if (state?.ok) {
    return (
      <Card className="p-6">
        <Alert tone="green" title="Buyer registered">{state.message}</Alert>
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200 sm:grid-cols-3">
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registration no.</div><div className="font-mono font-bold text-ink">{state.data?.regNo}</div></div>
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Temporary login</div><div className="font-mono font-bold text-ink">{state.data?.username}</div></div>
          {state.data?.password && <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Initial password</div><div className="font-mono font-bold text-ink">{state.data.password}</div></div>}
        </div>
        <p className="mt-3 text-xs text-slate-500"><KeyRound className="mr-1 inline size-3.5" />The buyer changes the password at first sign-in. The login becomes permanent once the Directorate approves the buyer.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" onClick={onAnother}><UserPlus className="size-4" /> Add another buyer</Button>
          <Link href={`/fieo/buyers/${state.data?.buyerId}`} className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">Open the buyer</Link>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      <Card>
        <CardHeader title="Buyer and login" subtitle="A temporary login (Tradex2027-NNN) is created and e-mailed to the login e-mail." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Name of the buyer" htmlFor="name" required error={fe.name} hint="English letters, numbers and . , & ' ( ) / -">
            <Input id="name" name="name" defaultValue={v("name")} maxLength={160} />
          </Field>
          <Field label="Country" htmlFor="country" required error={fe.country}>
            <Select id="country" name="country" defaultValue={v("country")}>
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Login e-mail" htmlFor="signupEmail" required error={fe.signupEmail} hint="Login details are sent here; must not be registered already.">
            <Input id="signupEmail" name="signupEmail" type="email" defaultValue={v("signupEmail")} maxLength={160} />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Point of contact" subtitle="Entered by FIEO, these basic details count as verified." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Contact person" htmlFor="pocName" required error={fe.pocName}><Input id="pocName" name="pocName" defaultValue={v("pocName")} maxLength={120} /></Field>
          <Field label="Designation" htmlFor="pocDesignation" required error={fe.pocDesignation}><Input id="pocDesignation" name="pocDesignation" defaultValue={v("pocDesignation")} maxLength={120} /></Field>
          <Field label="Contact e-mail" htmlFor="pocEmail" required error={fe.pocEmail}><Input id="pocEmail" name="pocEmail" type="email" defaultValue={v("pocEmail")} maxLength={160} /></Field>
          <Field label="Mobile (with country code)" htmlFor="pocMobile" required error={fe.pocMobile} hint="e.g. +971 50 123 4567"><Input id="pocMobile" name="pocMobile" type="tel" defaultValue={v("pocMobile")} maxLength={20} /></Field>
          <Field label="Company profile (optional)" htmlFor="profileFile" error={fe.profileFile} hint="PDF, JPG or PNG, up to 5 MB"><Input id="profileFile" name="profileFile" type="file" accept={accept} /></Field>
          <Field label="Organisation credentials (optional)" htmlFor="credentialsFile" error={fe.credentialsFile}><Input id="credentialsFile" name="credentialsFile" type="file" accept={accept} /></Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Sourcing profile" subtitle="Required when sector requirements are entered below; otherwise the buyer completes it." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          {([["organisationType", "Organisation type", ORGANISATION_TYPES], ["annualSourcingValue", "Annual sourcing value", SOURCING_VALUES], ["sourcingTimeline", "Sourcing timeline", SOURCING_TIMELINES], ["preferredEngagement", "Preferred engagement", ENGAGEMENT_TYPES]] as const).map(([k, label, opts]) => (
            <Field key={k} label={label} htmlFor={k} error={fe[k]}>
              <Select id={k} name={k} defaultValue={v(k)}><option value="">Select…</option>{opts.map((o) => <option key={o}>{o}</option>)}</Select>
            </Field>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Sector requirements (optional)" subtitle="Each one goes straight to the Directorate as recommended by FIEO. The buyer can add more after signing in." />
        <div className="divide-y divide-slate-100">
          {Array.from({ length: SLOTS }, (_, n) => n + 1).map((i) => (
            <div key={i} className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label={`Sector ${i}`} htmlFor={`sector-${i}`} error={fe[`sector-${i}`]}>
                <Select id={`sector-${i}`} name={`sector-${i}`} defaultValue={v(`sector-${i}`)}><option value="">—</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              </Field>
              <Field label="Products" htmlFor={`products-${i}`} error={fe[`products-${i}`]} hint="Separate with commas"><Input id={`products-${i}`} name={`products-${i}`} defaultValue={v(`products-${i}`)} maxLength={1000} /></Field>
              <Field label="Specifications" htmlFor={`specifications-${i}`} error={fe[`specifications-${i}`]}><Textarea id={`specifications-${i}`} name={`specifications-${i}`} rows={2} defaultValue={v(`specifications-${i}`)} maxLength={2000} /></Field>
              <div className="grid gap-4">
                <Field label="Quantity" htmlFor={`quantity-${i}`} error={fe[`quantity-${i}`]}><Input id={`quantity-${i}`} name={`quantity-${i}`} defaultValue={v(`quantity-${i}`)} maxLength={200} /></Field>
                <Field label="Certifications required" htmlFor={`certifications-${i}`} error={fe[`certifications-${i}`]} hint="Separate with semicolons, e.g. ISO 22000; HACCP"><Input id={`certifications-${i}`} name={`certifications-${i}`} defaultValue={v(`certifications-${i}`)} maxLength={600} /></Field>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex justify-end"><Button type="submit" disabled={pending}><UserPlus className="size-4" /> {pending ? "Registering…" : "Register buyer and send login"}</Button></div>
    </form>
  );
}

/** FIEO: bulk upload of buyers from the Excel template. */
export function BuyerBulkUpload() {
  const [state, action, pending] = useActionState(buyerBulkAction, undefined);
  const onSubmit = useKeepForm(action);
  const bad = state?.rows?.filter((r) => r.errors.length) ?? [];
  const previewed = state?.rows && !state.imported;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Step 1 — Download the template" icon={<FileSpreadsheet className="size-4" />}
          subtitle="Excel template with drop-down lists for country, sourcing profile and sectors (up to 3 sector requirements per buyer)." />
        <div className="p-6">
          <a href="/api/buyers/template" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
            <Download className="size-4 text-brand-700" /> Download buyer upload template (.xlsx)
          </a>
        </div>
      </Card>
      <Card>
        <CardHeader title="Step 2 — Upload and check" icon={<Upload className="size-4" />}
          subtitle="Every row is checked first — nothing is saved until you click Import. Each imported buyer gets a temporary login by e-mail." />
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required aria-label="Excel file"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100" />
          {state?.error && <Alert tone="red">{state.error}</Alert>}
          {state?.imported && (
            <Alert tone="green" title={`${state.imported.length} buyer${state.imported.length === 1 ? "" : "s"} imported`}>
              {state.imported[0]?.regNo} to {state.imported.at(-1)?.regNo} — temporary logins {state.imported[0]?.username} to {state.imported.at(-1)?.username} e-mailed.{" "}
              <Link href="/fieo/buyers?source=BULK" className="font-semibold underline">See them</Link>
              {bad.length > 0 && <> · {bad.length} row{bad.length === 1 ? " was" : "s were"} skipped (listed below).</>}
            </Alert>
          )}
          {previewed && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <span className="text-sm text-slate-700"><span className="font-semibold">{state.fileName}</span>:</span>
              <Badge tone="green">{state.valid} ready to import</Badge>
              {bad.length > 0 && <Badge tone="red">{bad.length} with errors</Badge>}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" name="intent" value="preview" variant="secondary" disabled={pending}><Upload className="size-4" /> {pending ? "Checking…" : "Upload & check"}</Button>
            {previewed && !!state.valid && <Button type="submit" name="intent" value="import" disabled={pending}><CheckCircle2 className="size-4" /> Import {state.valid} valid buyer{state.valid === 1 ? "" : "s"}</Button>}
          </div>
        </form>
        {(previewed || bad.length > 0) && state?.rows && (
          <div className="relative max-h-[520px] overflow-auto border-t border-slate-100">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">Buyer</th><th className="px-4 py-3">Login e-mail</th><th className="px-4 py-3">Result</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(previewed ? state.rows : bad).map((r) => (
                  <tr key={r.row} className={r.errors.length ? "bg-red-50/40" : ""}>
                    <td className="px-4 py-2.5 align-top text-slate-500">{r.row}</td>
                    <td className="px-4 py-2.5 align-top font-medium text-ink">{r.name || "—"}</td>
                    <td className="px-4 py-2.5 align-top text-xs">{r.email || "—"}</td>
                    <td className="px-4 py-2.5 align-top">{r.errors.length ? <ul className="list-disc space-y-0.5 pl-4 text-xs text-tx-red">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul> : <Badge tone="green">OK</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
