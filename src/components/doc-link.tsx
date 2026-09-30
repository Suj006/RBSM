import { FileText } from "lucide-react";
import { fmtBytes } from "@/lib/format";

export function DocLink({ doc }: { doc?: { id: string; originalName: string; size: number } | null }) {
  if (!doc) return <span className="text-sm text-slate-400">Not uploaded</span>;
  return (
    <a href={`/api/files/${doc.id}`} target="_blank" rel="noopener"
      className="inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-brand-800 ring-1 ring-slate-200 hover:bg-brand-50">
      <FileText className="size-4 shrink-0" />
      <span className="truncate">{doc.originalName}</span>
      <span className="shrink-0 text-xs text-slate-500">{fmtBytes(doc.size)}</span>
    </a>
  );
}
