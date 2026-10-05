import * as FLAGS from "country-flag-icons/string/3x2";
import { countryCode } from "@/lib/country-codes";
import { cn } from "@/lib/cn";

const SVG = FLAGS as unknown as Record<string, string>;

/** The country's flag (inline SVG, so it shows on every OS). Nothing when the country is unknown. */
export function Flag({ country, className }: { country: string | null | undefined; className?: string }) {
  const code = countryCode(country);
  const svg = code ? SVG[code] : undefined;
  if (!svg) return null;
  return (
    <span role="img" aria-label={country ?? ""} title={country ?? ""}
      className={cn("inline-block h-[0.85em] w-[1.275em] shrink-0 overflow-hidden rounded-[2px] align-[-0.08em] ring-1 ring-black/15 [&>svg]:block [&>svg]:size-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/** Flag (unless `flag={false}`) + ISO short code ("🇦🇪 AE"), with the full name as a tooltip — or after it when `name` is set. */
export function CountryTag({ country, name = false, flag = true, className }: { country: string | null | undefined; name?: boolean; flag?: boolean; className?: string }) {
  if (!country) return null;
  const code = countryCode(country);
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)} title={country}>
      {flag && <Flag country={country} />}
      <span className="font-semibold tracking-wide">{code || country}</span>
      {name && code && <span className="font-normal opacity-80">{country}</span>}
    </span>
  );
}

/** The participant's unique ID (approved number, else registration number) in a monospace pill. */
export function UidPill({ id, tone = "slate", className }: { id: string | null | undefined; tone?: "slate" | "buyer" | "seller" | "dark"; className?: string }) {
  if (!id) return null;
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-md px-1.5 py-px font-mono text-[11px] font-semibold tracking-tight ring-1",
      tone === "buyer" ? "bg-sky-50 text-sky-800 ring-sky-200" : tone === "seller" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : tone === "dark" ? "bg-white/15 text-white ring-white/25" : "bg-slate-50 text-slate-700 ring-slate-200",
      className)}>{id}</span>
  );
}

export const uid = (p: { approvedNo?: string | null; regNo?: string | null }) => p.approvedNo || p.regNo || "";
