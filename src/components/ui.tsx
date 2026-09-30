import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 shadow-sm",
  success: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  danger: "bg-tx-red text-white hover:bg-red-700 shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-ink",
};
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60";

export function Button({ variant = "primary", className, ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(btnBase, VARIANTS[variant], className)} {...p} />;
}

export function ButtonLink({
  variant = "primary", className, ...p
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(btnBase, VARIANTS[variant], className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)} {...p} />;
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</div>}
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-500 sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  green: "bg-brand-50 text-brand-800 ring-brand-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </span>
  );
}

const inputBase =
  "block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-ink shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cn(inputBase, className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cn(inputBase, "pr-8", className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "min-h-24", className)} {...p} />;
}

export function Field({ label, htmlFor, required, hint, error, children, className }: {
  label: ReactNode; htmlFor?: string; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-tx-red">*</span>}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-tx-red">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Alert({ tone = "blue", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl px-4 py-3 text-sm ring-1 ring-inset", TONES[tone], className)} role={tone === "red" ? "alert" : "status"}>
      {title && <div className="font-bold">{title}</div>}
      {children && <div className={cn(title ? "mt-0.5" : undefined, "opacity-90")}>{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, accent = "green", href }: {
  label: string; value: ReactNode; hint?: ReactNode; accent?: "green" | "red" | "yellow" | "blue" | "slate" | "violet"; href?: string;
}) {
  const bar = { green: "bg-tx-green", red: "bg-tx-red", yellow: "bg-tx-yellow", blue: "bg-tx-blue", slate: "bg-slate-400", violet: "bg-violet-500" }[accent];
  const body = (
    <Card className={cn("relative overflow-hidden p-5", href && "transition hover:-translate-y-0.5 hover:shadow-md")}>
      <span className={cn("absolute inset-y-0 left-0 w-1.5", bar)} />
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">{icon}</div>}
      <div className="font-semibold text-ink">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function DL({ items, cols = 2 }: { items: { label: string; value: ReactNode }[]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{it.label}</dt>
          <dd className="mt-1 break-words text-sm text-ink">{it.value || <span className="text-slate-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
