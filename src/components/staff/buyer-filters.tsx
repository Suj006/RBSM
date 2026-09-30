import { Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { STATUS_META } from "@/lib/status";
import type { BuyerStatus } from "@/generated/prisma/enums";
import type { BuyerFilters as F } from "@/lib/buyer-query";

export function BuyerFilters({ action, filters, statuses, countries, sectors, actionLabel }: {
  action: string; filters: F; statuses: BuyerStatus[]; countries: string[]; sectors: { id: string; name: string }[]; actionLabel: string;
}) {
  return (
    <form action={action} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input name="q" defaultValue={filters.q} placeholder="Search name, reg. no., e-mail…" className="pl-9" aria-label="Search" />
      </div>
      <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status">
        <option value="">All statuses</option>
        <option value="action">⚑ {actionLabel}</option>
        {statuses.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
      </Select>
      <Select name="country" defaultValue={filters.country ?? ""} aria-label="Country">
        <option value="">All countries</option>
        {countries.map((c) => <option key={c}>{c}</option>)}
      </Select>
      <Select name="sector" defaultValue={filters.sector ?? ""} aria-label="Sector">
        <option value="">All sectors</option>
        {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      <Button type="submit" variant="secondary">Apply</Button>
    </form>
  );
}
