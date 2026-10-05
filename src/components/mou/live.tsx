"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { fmtInr, fmtUsd, shortInr, shortUsd } from "@/lib/mou-format";
import { cn } from "@/lib/cn";

const FORMAT = {
  int: (v: number) => Math.round(v).toLocaleString("en-IN"),
  usd: fmtUsd, inr: fmtInr, shortUsd, shortInr,
} as const;

/**
 * A number that counts up on load and rolls to the new figure when the live dashboard refreshes —
 * with a short glow when it goes up, so a new MoU is noticed on the display.
 */
export function CountUp({ value, kind = "int", className }: { value: number; kind?: keyof typeof FORMAT; className?: string }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState(0);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const from = prev.current ?? 0;
    const first = prev.current === null;
    prev.current = value;
    if (from === value) return;
    const up = !first && value > from;
    const dur = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : first ? 1400 : 900;
    let raf = 0, start = 0;
    const step = (t: number) => {
      if (!start) { start = t; if (up) setFlash((f) => f + 1); }
      const k = dur ? Math.min(1, (t - start) / dur) : 1;
      setShown(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span key={flash} className={cn("tabular-nums", flash > 0 && "tx-flash rounded-lg", className)}>{FORMAT[kind](shown)}</span>;
}

/** Shows the dashboard alone, full screen — for the display at the venue. */
export function DisplayMode({ target }: { target: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.getElementById(target)?.requestFullscreen();
  };
  return (
    <button type="button" onClick={toggle} className="inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-700">
      {on ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />} {on ? "Exit display" : "Display mode"}
    </button>
  );
}
