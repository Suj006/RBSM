"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature } from "lucide-react";
import { saveMouAction } from "@/app/actions/mou";
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";

export type PartnerOption = { id: string; label: string; sectors: { id: string; name: string }[]; common: string[]; meeting: string | null };
type Initial = { mouId?: string; sellerId?: string; sectorId?: string; goods?: string; currency?: string; amount?: string; tbd?: boolean; orderMonth?: string };

/** Buyer: the only things to fill — the auto-filled details are shown on the MoU itself. */
export function MouForm({ partners, initial = {}, minMonth, base }: { partners: PartnerOption[]; initial?: Initial; minMonth: string; base: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (s: Awaited<ReturnType<typeof saveMouAction>>, fd: FormData) => {
    const r = await saveMouAction(s, fd);
    if (r?.ok && r.data?.mouId) router.push(`${base}/${r.data.mouId}?saved=1`);
    return r;
  }, undefined);
  const onSubmit = useKeepForm(action);
  const fe = state?.fieldErrors ?? {};
  const [sellerId, setSellerId] = useState(initial.sellerId ?? "");
  const [tbd, setTbd] = useState(initial.tbd ?? false);
  const p = partners.find((x) => x.id === sellerId);
  const sectors = p ? [...p.sectors].sort((a, b) => Number(p.common.includes(b.id)) - Number(p.common.includes(a.id))) : [];
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {initial.mouId && <input type="hidden" name="mouId" value={initial.mouId} />}
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      <Card>
        <CardHeader title="Seller" icon={<FileSignature className="size-4" />} subtitle="Your matched sellers — those you met first. Names, IDs, addresses and the meeting are filled in on the MoU automatically." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Seller" htmlFor="sellerId" required error={fe.sellerId}>
            <Select id="sellerId" name="sellerId" value={sellerId} onChange={(e) => setSellerId(e.target.value)} disabled={!!initial.mouId}>
              <option value="">Choose the seller…</option>
              {partners.map((x) => <option key={x.id} value={x.id}>{x.label}{x.meeting ? ` — met ${x.meeting}` : ""}</option>)}
            </Select>
            {initial.mouId && <input type="hidden" name="sellerId" value={sellerId} />}
          </Field>
          <Field label="Sector" htmlFor="sectorId" required error={fe.sectorId}>
            <Select key={sellerId} id="sectorId" name="sectorId" defaultValue={initial.sellerId === sellerId ? initial.sectorId : (sectors[0]?.id ?? "")} disabled={!p}>
              {!p && <option value="">Choose the seller first</option>}
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}{p?.common.includes(s.id) ? "" : " (not one of your sectors)"}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="What you intend to order" />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Description of goods" htmlFor="goods" required error={fe.goods} className="sm:col-span-2" hint="e.g. Instant chutney powders — coconut, curry leaf and ginger, 200 g retail packs">
            <Textarea id="goods" name="goods" rows={3} maxLength={600} defaultValue={state?.data?.goods ?? initial.goods} />
          </Field>
          <Field label="Approximate value" htmlFor="amount" required={!tbd} error={fe.amount ?? fe.currency}>
            <div className="flex gap-2">
              <Select name="currency" aria-label="Currency" defaultValue={state?.data?.currency ?? initial.currency ?? "USD"} className="w-28 shrink-0">
                <option value="USD">US$</option><option value="INR">INR ₹</option>
              </Select>
              <Input id="amount" name="amount" inputMode="decimal" placeholder={tbd ? "To be determined" : "e.g. 50000"} disabled={tbd} defaultValue={state?.data?.amount ?? initial.amount} />
            </div>
            <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="tbd" checked={tbd} onChange={(e) => setTbd(e.target.checked)} className="size-4 rounded border-slate-300" /> To be determined</label>
          </Field>
          <Field label="Approximate month of placing the order" htmlFor="orderMonth" required error={fe.orderMonth}>
            <Input id="orderMonth" name="orderMonth" type="month" min={minMonth} defaultValue={state?.data?.orderMonth ?? initial.orderMonth} />
          </Field>
        </div>
      </Card>
      <div className="flex justify-end"><Button type="submit" disabled={pending}><FileSignature className="size-4" /> {pending ? "Submitting…" : initial.mouId ? "Submit again" : "Submit MoU for verification"}</Button></div>
    </form>
  );
}
