import { Check, X } from "lucide-react";
import type { BuyerStatus } from "@/generated/prisma/enums";
import { JOURNEY, STATUS_META } from "@/lib/status";
import { cn } from "@/lib/cn";

const RETURNED: BuyerStatus[] = ["BASIC_RETURNED", "REQ_RETURNED", "DIC_RETURNED"];

/** Horizontal progress through the six registration steps. */
export function JourneyStepper({ status }: { status: BuyerStatus }) {
  const stage = STATUS_META[status].stage; // index of the current step
  const returned = RETURNED.includes(status);
  return (
    <ol className="grid grid-cols-3 gap-y-5 sm:grid-cols-6">
      {JOURNEY.map((label, i) => {
        const done = i < stage || status === "APPROVED";
        const current = i === stage && status !== "APPROVED";
        return (
          <li key={label} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span className={cn("absolute right-1/2 top-4 hidden h-0.5 w-full -translate-y-1/2 sm:block", done || current ? "bg-brand-500" : "bg-slate-200")} aria-hidden />
            )}
            <span
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full text-xs font-bold ring-4 ring-white",
                done && "bg-brand-600 text-white",
                current && !returned && "bg-tx-yellow text-ink",
                current && returned && "bg-tx-red text-white",
                !done && !current && "bg-slate-200 text-slate-500",
              )}
            >
              {done ? <Check className="size-4" /> : current && returned ? <X className="size-4" /> : i + 1}
            </span>
            <span className={cn("mt-2 px-1 text-xs font-medium", current ? "text-ink" : done ? "text-brand-800" : "text-slate-400")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
