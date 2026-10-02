"use client";

import { useActionState, useState } from "react";
import { Save, Shuffle } from "lucide-react";
import { saveTargetsAction } from "@/app/actions/targets";
import { Alert, Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";
import { cn } from "@/lib/cn";

export function TargetsForm({ initial, districts, approved }: {
  initial: { sellers: number; buyers: number; sellersPerBuyer: number; district: Record<string, number> };
  districts: readonly string[];
  approved: Record<string, number>;
}) {
  const [state, action, pending] = useActionState(saveTargetsAction, undefined);
  const onSubmit = useKeepForm(action);
  const [sellers, setSellers] = useState(String(initial.sellers));
  const [dist, setDist] = useState<Record<string, string>>(Object.fromEntries(districts.map((d) => [d, String(initial.district[d] ?? 0)])));
  const fe = state?.fieldErrors ?? {};
  const sum = districts.reduce((a, d) => a + (Number(dist[d]) || 0), 0);
  const overall = Number(sellers) || 0;

  const distribute = () => {
    const n = districts.length, base = Math.floor(overall / n);
    let extra = overall - base * n;
    setDist(Object.fromEntries(districts.map((d) => [d, String(base + (extra-- > 0 ? 1 : 0))])));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone={state.message?.startsWith("Targets saved. Note") ? "amber" : "green"}>{state.message}</Alert>}

      <Card>
        <CardHeader title="Programme targets" subtitle="Shown on all dashboards and in the District-wise Seller Summary report." />
        <div className="grid gap-5 p-6 sm:grid-cols-3">
          <Field label="Approved sellers (overall)" htmlFor="sellers" required error={fe.sellers}>
            <Input id="sellers" name="sellers" type="number" min={1} inputMode="numeric" value={sellers} onChange={(e) => setSellers(e.target.value)} />
          </Field>
          <Field label="Approved buyers" htmlFor="buyers" required error={fe.buyers}>
            <Input id="buyers" name="buyers" type="number" min={1} inputMode="numeric" defaultValue={initial.buyers} />
          </Field>
          <Field label="Sellers each buyer should meet" htmlFor="sellersPerBuyer" required error={fe.sellersPerBuyer}>
            <Input id="sellersPerBuyer" name="sellersPerBuyer" type="number" min={1} inputMode="numeric" defaultValue={initial.sellersPerBuyer} />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="District-wise approved seller targets"
          subtitle="Each District Industries Centre sees its own target on its dashboard."
          action={<Button type="button" variant="secondary" onClick={distribute}><Shuffle className="size-4" /> Distribute {overall} evenly</Button>} />
        <div className="table-scroll relative overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">District</th>
                <th className="px-4 py-3 text-right">Approved so far</th>
                <th className="w-44 px-6 py-3 text-right">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {districts.map((d) => (
                <tr key={d}>
                  <td className="px-6 py-2 font-medium text-ink">{d}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{approved[d] ?? 0}</td>
                  <td className="px-6 py-2">
                    <Input name={`d:${d}`} type="number" min={0} inputMode="numeric" aria-label={`Target for ${d}`} className="ml-auto w-28 text-right"
                      value={dist[d]} onChange={(e) => setDist((x) => ({ ...x, [d]: e.target.value }))} />
                    {fe[`d:${d}`] && <p className="mt-1 text-right text-xs text-tx-red">{fe[`d:${d}`]}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-600 bg-brand-50 font-semibold">
                <td className="px-6 py-3 text-ink">Total of district targets</td>
                <td className="px-4 py-3 text-right tabular-nums">{Object.values(approved).reduce((a, b) => a + b, 0)}</td>
                <td className={cn("px-6 py-3 text-right tabular-nums", sum !== overall ? "text-amber-700" : "text-brand-800")}>
                  {sum}{sum !== overall && <span className="ml-2 text-xs font-medium">(overall: {overall})</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}><Save className="size-4" /> {pending ? "Saving…" : "Save targets"}</Button>
      </div>
    </form>
  );
}
