"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Select } from "@/components/ui";
import { COUNTRIES } from "@/lib/countries";

/** Several countries picked from the world list; posts a JSON array as `name`. */
export function CountryMulti({ id, name, initial, invalid }: { id: string; name: string; initial: string[]; invalid?: boolean }) {
  const [list, setList] = useState<string[]>(initial);
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(list)} />
      <Select id={id} value="" aria-invalid={invalid || undefined}
        onChange={(e) => { const v = e.target.value; if (v) setList((xs) => (xs.includes(v) ? xs : [...xs, v])); }}>
        <option value="">{list.length ? "Add another country…" : "Select country…"}</option>
        {COUNTRIES.filter((c) => !list.includes(c)).map((c) => <option key={c}>{c}</option>)}
      </Select>
      {list.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Countries selected">
          {list.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
              {c}
              <button type="button" onClick={() => setList((xs) => xs.filter((x) => x !== c))} aria-label={`Remove ${c}`} className="hover:text-tx-red"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
