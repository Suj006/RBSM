import Image from "next/image";
import { EVENT } from "@/lib/config";
import { cn } from "@/lib/cn";

export function Logo({ className, withText = true, invert = false }: { className?: string; withText?: boolean; invert?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image src={EVENT.logo} alt="TRADEX" width={132} height={45} priority className="h-9 w-auto" />
      {withText && (
        <div className={cn("hidden border-l pl-3 leading-tight sm:block", invert ? "border-white/30" : "border-slate-200")}>
          <div className={cn("text-[11px] font-bold uppercase tracking-[0.18em]", invert ? "text-white" : "text-ink")}>2.0 · {EVENT.short}</div>
          <div className={cn("text-[11px]", invert ? "text-white/70" : "text-slate-500")}>{EVENT.programme}</div>
        </div>
      )}
    </div>
  );
}
