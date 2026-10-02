"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

const PREFIX = "UDYAM-KL-";

function split(v: string) {
  const m = v.toUpperCase().replace(/\s+/g, "").match(/^(?:UDYAM-?)?(?:KL-?)?(\d{0,2})-?(\d{0,7})$/);
  return m ? { dd: m[1] ?? "", num: m[2] ?? "" } : { dd: "", num: "" };
}

/**
 * Udyam number with the fixed "UDYAM-KL-" part shown, not typed: the user enters
 * only the 2-digit and 7-digit parts. Pasting a full number fills both boxes.
 */
export function UdyamInput({ name, defaultValue, invalid }: { name: string; defaultValue?: string; invalid?: boolean }) {
  const init = split(defaultValue ?? "");
  const [dd, setDd] = useState(init.dd);
  const [num, setNum] = useState(init.num);
  const numRef = useRef<HTMLInputElement>(null);
  const digits = (s: string) => s.replace(/\D/g, "");

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (/[-A-Za-z]/.test(text) || digits(text).length > 2) {
      e.preventDefault();
      const p = split(text.trim());
      const all = digits(text.replace(/^.*?KL/i, ""));
      setDd(p.dd || all.slice(0, 2));
      setNum(p.num || all.slice(2, 9));
      numRef.current?.focus();
    }
  };

  const value = dd || num ? `${PREFIX}${dd}-${num}` : "";
  const box = "border-0 bg-white py-2.5 text-sm font-mono tracking-wider text-ink placeholder:text-slate-300 focus:ring-0 focus:outline-none";
  return (
    <div className={cn("flex items-stretch overflow-hidden rounded-lg shadow-sm ring-1 ring-inset focus-within:ring-2 focus-within:ring-brand-600",
      invalid ? "ring-tx-red" : "ring-slate-300")}>
      <input type="hidden" name={name} value={value} />
      <span className="flex select-none items-center bg-slate-100 px-3 font-mono text-sm font-semibold tracking-wider text-slate-600" aria-hidden>{PREFIX}</span>
      <input aria-label="Udyam number — 2-digit part" inputMode="numeric" maxLength={2} placeholder="00" value={dd} onPaste={onPaste}
        onChange={(e) => { const v = digits(e.target.value).slice(0, 2); setDd(v); if (v.length === 2) numRef.current?.focus(); }}
        className={cn(box, "w-12 px-2 text-center")} />
      <span className="flex items-center font-mono text-slate-400" aria-hidden>-</span>
      <input ref={numRef} aria-label="Udyam number — 7-digit part" inputMode="numeric" maxLength={7} placeholder="0000000" value={num} onPaste={onPaste}
        onChange={(e) => setNum(digits(e.target.value).slice(0, 7))}
        onKeyDown={(e) => { if (e.key === "Backspace" && !num) (e.currentTarget.previousElementSibling?.previousElementSibling as HTMLInputElement | null)?.focus(); }}
        className={cn(box, "min-w-0 flex-1 px-2")} />
    </div>
  );
}
