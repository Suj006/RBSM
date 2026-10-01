import { FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/cn";

/** Excel + PDF download pair for one report. */
export function DownloadButtons({ href, label, compact }: { href: string; label?: string; compact?: boolean }) {
  const sep = href.includes("?") ? "&" : "?";
  const base = "inline-flex items-center gap-2 rounded-lg bg-white text-sm font-semibold text-ink ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50";
  return (
    <div className="no-print inline-flex items-center gap-2">
      {label && <span className="text-sm font-medium text-slate-500">{label}</span>}
      <a href={`${href}${sep}format=xlsx`} className={cn(base, compact ? "px-3 py-2" : "px-4 py-2.5")} title="Download formatted Excel workbook">
        <FileSpreadsheet className="size-4 text-brand-700" /> Excel
      </a>
      <a href={`${href}${sep}format=pdf`} target="_blank" rel="noopener" className={cn(base, compact ? "px-3 py-2" : "px-4 py-2.5")} title="Open PDF report">
        <FileText className="size-4 text-tx-red" /> PDF
      </a>
    </div>
  );
}
