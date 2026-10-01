import type { ItemStatus } from "@/generated/prisma/enums";
import { ITEM_META } from "@/lib/status";
import { cn } from "@/lib/cn";

/** Compact list of sectors, each with a coloured status dot. */
export function ItemChips({ items, max = 3 }: { items: { status: ItemStatus; sector: { name: string } }[]; max?: number }) {
  if (!items.length) return <span className="text-slate-400">—</span>;
  return (
    <ul className="flex flex-wrap gap-1">
      {items.slice(0, max).map((i) => (
        <li key={i.sector.name} title={`${i.sector.name}: ${ITEM_META[i.status].label}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">
          <span className={cn("size-1.5 shrink-0 rounded-full", ITEM_META[i.status].dot)} />
          {i.sector.name}
        </li>
      ))}
      {items.length > max && <li className="px-1 text-[11px] text-slate-500">+{items.length - max}</li>}
    </ul>
  );
}
