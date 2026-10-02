import { ArrowRight, List } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export type NextUpLinks = { next: string | null; list: string; listLabel: string };

/** Shown after a decision is saved: straight on to the next pending application, or back to the list. */
export function NextUp({ next, list, listLabel }: NextUpLinks) {
  return (
    <div className="no-print mt-3 flex flex-wrap gap-2">
      {next ? (
        <ButtonLink href={next} className="px-3 py-2">Next pending application <ArrowRight className="size-4" /></ButtonLink>
      ) : (
        <span className="self-center text-sm text-slate-600">Nothing else is waiting for your decision.</span>
      )}
      <ButtonLink href={list} variant="secondary" className="px-3 py-2"><List className="size-4" /> {listLabel}</ButtonLink>
    </div>
  );
}
