"use client";

import { useState } from "react";
import { Paperclip, Plus, X } from "lucide-react";
import { Input } from "@/components/ui";

const MAX = 3;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx";

/** Up to three documents to share, each with the name the sender gives it. Posts file-i / docName-i. */
export function DocRows({ errors, resetKey }: { errors: Record<string, string>; resetKey: number }) {
  const [rows, setRows] = useState<number[]>([]);
  const [prevKey, setPrevKey] = useState(resetKey);
  if (prevKey !== resetKey) { setPrevKey(resetKey); setRows([]); }
  const next = () => { for (let i = 0; i < MAX; i++) if (!rows.includes(i)) return i; return -1; };
  return (
    <div className="space-y-2">
      {rows.map((i) => (
        <div key={`${resetKey}-${i}`} className="grid gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          <div>
            <Input name={`docName-${i}`} placeholder="Document name (required), e.g. Product catalogue 2026" maxLength={120} aria-label="Document name" />
            {errors[`docName-${i}`] && <p className="mt-1 text-xs font-medium text-tx-red">{errors[`docName-${i}`]}</p>}
          </div>
          <div>
            <input type="file" name={`file-${i}`} accept={ACCEPT} aria-label="Document file"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 file:ring-1 file:ring-slate-200" />
            {errors[`file-${i}`] && <p className="mt-1 text-xs font-medium text-tx-red">{errors[`file-${i}`]}</p>}
          </div>
          <button type="button" onClick={() => setRows((r) => r.filter((x) => x !== i))} aria-label="Remove document"
            className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-tx-red"><X className="size-4" /></button>
        </div>
      ))}
      {rows.length < MAX && (
        <button type="button" onClick={() => { const n = next(); if (n >= 0) setRows((r) => [...r, n]); }}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          {rows.length ? <Plus className="size-4" /> : <Paperclip className="size-4" />} {rows.length ? "Add another document" : "Share a document"}
        </button>
      )}
      {rows.length > 0 && <p className="text-xs text-slate-500">PDF, JPG, PNG, Word (.docx) or Excel (.xlsx), up to 5 MB each; up to {MAX} per message.</p>}
    </div>
  );
}
