"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Pick certifications from the master list, or add others; posts a JSON array as `name`. */
export function CertPicker({ name, master, initial, error }: { name: string; master: string[]; initial: string[]; error?: string }) {
  const [certs, setCerts] = useState<string[]>(initial);
  const [other, setOther] = useState("");
  const [otherError, setOtherError] = useState("");
  const custom = certs.filter((c) => !master.includes(c));
  const toggle = (c: string) => setCerts((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));
  const addOther = () => {
    const v = other.trim().replace(/\s+/g, " ");
    if (!v) return;
    if (!/^[\x20-\x7E]+$/.test(v)) return setOtherError("Use English characters only.");
    const hit = master.find((m) => m.toLowerCase() === v.toLowerCase());
    setCerts((xs) => (xs.some((x) => x.toLowerCase() === v.toLowerCase()) ? xs : [...xs, hit ?? v]));
    setOther(""); setOtherError("");
  };
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(certs)} />
      <div className="flex flex-wrap gap-2">
        {master.map((c) => {
          const on = certs.includes(c);
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
      <p className="mt-1.5 text-xs text-slate-500">
        {certs.length ? `${certs.length} selected.` : "None selected — leave empty if the unit holds no certification."}
      </p>
      {(otherError || error) && <p className="mt-1 text-xs font-medium text-tx-red">{otherError || error}</p>}
    </div>
  );
}
