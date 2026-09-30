"use client";

import { useKeepForm } from "@/lib/use-keep-form";
import { useActionState, useState } from "react";
import { Plus, Save, Send, Trash2, X } from "lucide-react";
import { saveRequirementAction } from "@/app/actions/buyer";
import { Alert, Button, Card, CardHeader, Field, Select, Textarea, Input } from "@/components/ui";
import { ENGAGEMENT_TYPES, ORGANISATION_TYPES, SOURCING_TIMELINES, SOURCING_VALUES } from "@/lib/config";
import { cn } from "@/lib/cn";

export type ReqItem = { sectorId: string; products: string; specifications: string; certifications: string[]; quantity: string };
type Header = { organisationType: string; procurementInterests: string; annualSourcingValue: string; sourcingTimeline: string; preferredEngagement: string };

const blank = (): ReqItem => ({ sectorId: "", products: "", specifications: "", certifications: [], quantity: "" });

export function RequirementForm({ header, items: initialItems, sectors, certifications }: {
  header: Header;
  items: ReqItem[];
  sectors: { id: string; name: string }[];
  certifications: string[];
}) {
  const [state, action, pending] = useActionState(saveRequirementAction, undefined);
  const onSubmit = useKeepForm(action);
  const [items, setItems] = useState<ReqItem[]>(initialItems.length ? initialItems : [blank()]);
  const fe = state?.fieldErrors ?? {};
  const update = (i: number, patch: Partial<ReqItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const usedSectors = new Set(items.map((i) => i.sectorId));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <Card>
        <CardHeader title="Sourcing profile" subtitle="Helps us match you with the right MSME suppliers." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Organisation type" htmlFor="organisationType" required error={fe.organisationType}>
            <Select id="organisationType" name="organisationType" defaultValue={header.organisationType}>
              <option value="">Select…</option>
              {ORGANISATION_TYPES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Indicative annual sourcing value" htmlFor="annualSourcingValue" required error={fe.annualSourcingValue}>
            <Select id="annualSourcingValue" name="annualSourcingValue" defaultValue={header.annualSourcingValue}>
              <option value="">Select…</option>
              {SOURCING_VALUES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Sourcing timeline" htmlFor="sourcingTimeline" required error={fe.sourcingTimeline}>
            <Select id="sourcingTimeline" name="sourcingTimeline" defaultValue={header.sourcingTimeline}>
              <option value="">Select…</option>
              {SOURCING_TIMELINES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Preferred engagement" htmlFor="preferredEngagement" error={fe.preferredEngagement}>
            <Select id="preferredEngagement" name="preferredEngagement" defaultValue={header.preferredEngagement}>
              <option value="">Select…</option>
              {ENGAGEMENT_TYPES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Procurement interests" htmlFor="procurementInterests" required error={fe.procurementInterests} className="sm:col-span-2"
            hint="What you are looking to source, target price points, quality expectations, markets you supply to…">
            <Textarea id="procurementInterests" name="procurementInterests" rows={4} maxLength={3000} defaultValue={header.procurementInterests} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Sectors, products & certifications"
          subtitle="Add one row per sector you want to source from."
          action={
            <Button type="button" variant="secondary" onClick={() => setItems((xs) => [...xs, blank()])} disabled={items.length >= 25}>
              <Plus className="size-4" /> Add sector
            </Button>
          }
        />
        {fe.items && <Alert tone="red" className="mx-6 mt-5">{fe.items}</Alert>}
        <div className="divide-y divide-slate-100">
          {items.map((it, i) => (
            <SectorRow
              key={i}
              index={i}
              item={it}
              sectors={sectors.filter((s) => s.id === it.sectorId || !usedSectors.has(s.id))}
              certifications={certifications}
              errors={fe}
              onChange={(p) => update(i, p)}
              onRemove={items.length > 1 ? () => setItems((xs) => xs.filter((_, j) => j !== i)) : undefined}
            />
          ))}
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>
          <Save className="size-4" /> Save
        </Button>
        <Button type="submit" name="intent" value="submit" disabled={pending}>
          <Send className="size-4" /> {pending ? "Submitting…" : "Submit to FIEO"}
        </Button>
      </div>
    </form>
  );
}

function SectorRow({ index, item, sectors, certifications, errors, onChange, onRemove }: {
  index: number; item: ReqItem; sectors: { id: string; name: string }[]; certifications: string[];
  errors: Record<string, string>; onChange: (p: Partial<ReqItem>) => void; onRemove?: () => void;
}) {
  const [other, setOther] = useState("");
  const err = (k: string) => errors[`items.${index}.${k}`];
  const toggle = (c: string) =>
    onChange({ certifications: item.certifications.includes(c) ? item.certifications.filter((x) => x !== c) : [...item.certifications, c] });
  const custom = item.certifications.filter((c) => !certifications.includes(c));
  const addOther = () => {
    const v = other.trim();
    if (v && !item.certifications.includes(v)) onChange({ certifications: [...item.certifications, v] });
    setOther("");
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Sector {index + 1}</div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs font-semibold text-tx-red hover:underline">
            <Trash2 className="size-3.5" /> Remove
          </button>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Sector" htmlFor={`sector-${index}`} required error={err("sectorId")}>
          <Select id={`sector-${index}`} value={item.sectorId} onChange={(e) => onChange({ sectorId: e.target.value })}>
            <option value="">Select sector…</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Indicative quantity / volume" htmlFor={`qty-${index}`} error={err("quantity")} hint="e.g. 2 containers per quarter">
          <Input id={`qty-${index}`} value={item.quantity} maxLength={200} onChange={(e) => onChange({ quantity: e.target.value })} />
        </Field>
        <Field label="Products" htmlFor={`products-${index}`} required error={err("products")} className="sm:col-span-2" hint="Separate products with commas">
          <Textarea id={`products-${index}`} rows={2} maxLength={1000} value={item.products} onChange={(e) => onChange({ products: e.target.value })}
            placeholder="e.g. Black pepper, Cardamom, Turmeric powder" />
        </Field>
        <Field label="Product specifications" htmlFor={`spec-${index}`} error={err("specifications")} className="sm:col-span-2">
          <Textarea id={`spec-${index}`} rows={2} maxLength={2000} value={item.specifications} onChange={(e) => onChange({ specifications: e.target.value })}
            placeholder="Grade, size, packaging, shelf life, labelling…" />
        </Field>
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold text-slate-700">Relevant certifications</div>
        <div className="flex flex-wrap gap-2">
          {certifications.map((c) => {
            const on = item.certifications.includes(c);
            return (
              <button type="button" key={c} onClick={() => toggle(c)} aria-pressed={on}
                className={cn("rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
                  on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50")}>
                {c}
              </button>
            );
          })}
          {custom.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-tx-blue px-3 py-1.5 text-xs font-medium text-white">
              {c}
              <button type="button" onClick={() => toggle(c)} aria-label={`Remove ${c}`}><X className="size-3" /></button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex max-w-md gap-2">
          <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Other certification…" maxLength={120}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }} aria-label="Other certification" />
          <Button type="button" variant="secondary" onClick={addOther}>Add</Button>
        </div>
      </div>
    </div>
  );
}
