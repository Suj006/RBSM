"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Info, Plus, Send, Star, X } from "lucide-react";
import { submitPreferencesAction } from "@/app/actions/matchmaking";
import { Alert, Badge, Button, Card, CardHeader, Input, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

export type DirectoryBuyer = {
  id: string; name: string; approvedNo: string | null; country: string; flag?: React.ReactNode; relevant: boolean;
  sectors: { id: string; name: string; products: string; specifications: string | null; certifications: string[]; quantity: string | null }[];
};

const MAX = 5;

/** Approved buyers for an approved seller, with the tentative preference picker (up to 5, in order). */
export function BuyerDirectory({ buyers, canPick, sectors }: { buyers: DirectoryBuyer[]; canPick: boolean; sectors: { id: string; name: string }[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [sector, setSector] = useState("");
  const [q, setQ] = useState("");
  const [onlyRelevant, setOnlyRelevant] = useState(false);
  const [ack, setAck] = useState(false);
  const [state, action, pending] = useActionState(submitPreferencesAction, undefined);
  const byId = useMemo(() => new Map(buyers.map((b) => [b.id, b])), [buyers]);
  const list = buyers.filter((b) =>
    (!sector || b.sectors.some((s) => s.id === sector)) && (!onlyRelevant || b.relevant) &&
    (!q || `${b.name} ${b.approvedNo ?? ""} ${b.country} ${b.sectors.map((s) => s.products).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const move = (i: number, d: -1 | 1) => setPicked((p) => { const n = [...p]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  if (state?.ok) return <Alert tone="green" title="Preferences submitted">{state.message}</Alert>;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-4">
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1.2fr_auto] sm:items-center">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search buyer, buyer ID, country or product…" aria-label="Search" />
            <Select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
              <option value="">All sectors</option>
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={onlyRelevant} onChange={(e) => setOnlyRelevant(e.target.checked)} className="accent-brand-700" /> Only my sectors
            </label>
          </div>
        </Card>
        <p className="text-sm text-slate-500">{list.length} approved buyer{list.length === 1 ? "" : "s"}{buyers.some((b) => b.relevant) ? " · buyers in your sectors are marked" : ""}</p>
        {list.map((b) => {
          const rank = picked.indexOf(b.id);
          return (
            <Card key={b.id} className={cn("overflow-hidden", rank >= 0 && "ring-2 ring-brand-300")}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-ink">{b.name}</h3>
                    {b.relevant && <Badge tone="green">Your sector</Badge>}
                    {rank >= 0 && <Badge tone="violet">Preference #{rank + 1}</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500"><span className="rounded-md bg-sky-50 px-1.5 py-px font-mono text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">{b.approvedNo}</span> {b.flag} {b.country}</div>
                </div>
                {canPick && (rank >= 0
                  ? <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setPicked((p) => p.filter((x) => x !== b.id))}><X className="size-3.5" /> Remove</Button>
                  : <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" disabled={picked.length >= MAX} onClick={() => setPicked((p) => [...p, b.id])}>
                      <Plus className="size-3.5" /> {picked.length >= MAX ? "5 chosen" : "Add to my preferences"}</Button>)}
              </div>
              <ul className="divide-y divide-slate-100">
                {b.sectors.map((s) => (
                  <li key={s.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[200px_1fr]">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div>
                      <div className="text-slate-700">{s.products}</div>
                      {s.specifications && <div className="mt-0.5 text-xs text-slate-500">Specifications: {s.specifications}</div>}
                      {s.quantity && <div className="text-xs text-slate-500">Indicative volume: {s.quantity}</div>}
                      {s.certifications.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{s.certifications.map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {canPick && (
        <form action={action} className="xl:sticky xl:top-6"
          onSubmit={(e) => { if (!window.confirm("Submit your preferences? Once submitted, they cannot be changed.")) e.preventDefault(); }}>
          <Card>
            <CardHeader title="My preferences" subtitle={`Choose up to ${MAX} buyers, most preferred first`} icon={<Star className="size-4" />} />
            <div className="space-y-4 p-5">
              <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                <Info className="mt-0.5 size-4 shrink-0" />
                <div>
                  <b>These are tentative preferences.</b> The Directorate will consider them together with other conditions — the buyer&apos;s requirement,
                  sector and product fit, and the number of sellers each buyer can meet. A preference does not guarantee a meeting.
                  <b> Once submitted, preferences cannot be changed.</b>
                </div>
              </div>
              <ol className="space-y-2">
                {picked.map((id, i) => (
                  <li key={id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                    <input type="hidden" name="buyerIds" value={id} />
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{byId.get(id)?.name}</span>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                    <button type="button" aria-label="Move down" disabled={i === picked.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                    <button type="button" aria-label="Remove" onClick={() => setPicked((p) => p.filter((x) => x !== id))} className="rounded p-1 text-slate-500 hover:bg-white"><X className="size-3.5" /></button>
                  </li>
                ))}
                {!picked.length && <li className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">Use “Add to my preferences” on a buyer.</li>}
              </ol>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" name="ack" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-brand-700" />
                I understand these preferences are tentative and that I cannot change them after submitting.
              </label>
              {state?.error && <Alert tone="red">{state.error}</Alert>}
              <Button type="submit" className="w-full" disabled={pending || !picked.length || !ack}>
                <Send className="size-4" /> {pending ? "Submitting…" : `Submit ${picked.length || ""} preference${picked.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
