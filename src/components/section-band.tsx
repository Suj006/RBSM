import Link from "next/link";
import { Globe2, Store } from "lucide-react";
import { cn } from "@/lib/cn";

const KIND = {
  buyers: { icon: Globe2, eyebrow: "International buyers", bar: "bg-tx-blue", soft: "bg-tx-blue/10 text-tx-blue", ring: "ring-tx-blue/25" },
  sellers: { icon: Store, eyebrow: "Kerala MSME sellers", bar: "bg-tx-green", soft: "bg-tx-green/10 text-brand-700", ring: "ring-tx-green/25" },
} as const;

/** Header band that opens the buyer or seller half of a dashboard, so the two are told apart at a glance. */
export function SectionBand({ id, kind, title, summary, links }: {
  id: string; kind: keyof typeof KIND; title: string; summary?: React.ReactNode; links?: { href: string; label: string; primary?: boolean }[];
}) {
  const k = KIND[kind];
  return (
    <div id={id} className={cn("relative mb-5 scroll-mt-24 overflow-hidden rounded-2xl bg-white shadow-sm ring-1", k.ring)}>
      <span className={cn("absolute inset-y-0 left-0 w-1.5", k.bar)} />
      <div className="flex flex-wrap items-center justify-between gap-4 py-4 pl-6 pr-5">
        <div className="flex items-center gap-4">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", k.soft)}><k.icon className="size-6" /></span>
          <div>
            <div className={cn("text-xs font-bold uppercase tracking-wider", kind === "buyers" ? "text-tx-blue" : "text-brand-700")}>{k.eyebrow}</div>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">{title}</h2>
            {summary && <div className="text-sm text-slate-500">{summary}</div>}
          </div>
        </div>
        {links && (
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={cn("inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold",
                l.primary ? "bg-ink text-white hover:bg-ink/90" : "text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50")}>{l.label}</Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Jump links at the top of a dashboard that has both halves. */
export function SectionJumps() {
  return (
    <div className="flex flex-wrap gap-2">
      <a href="#buyers" className="inline-flex items-center gap-2 rounded-lg bg-tx-blue/10 px-3.5 py-2 text-sm font-semibold text-tx-blue ring-1 ring-inset ring-tx-blue/25 hover:bg-tx-blue/15">
        <Globe2 className="size-4" /> Buyers
      </a>
      <a href="#sellers" className="inline-flex items-center gap-2 rounded-lg bg-tx-green/10 px-3.5 py-2 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-tx-green/25 hover:bg-tx-green/15">
        <Store className="size-4" /> Sellers
      </a>
    </div>
  );
}
