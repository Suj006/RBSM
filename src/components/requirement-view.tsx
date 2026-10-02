import { Card, CardHeader } from "@/components/ui";
import { diffProfile, PROFILE_LABELS, type ProfileSnapshot } from "@/lib/item-snapshot";
import { cn } from "@/lib/cn";

type Profile = {
  organisationType: string | null; procurementInterests: string | null; annualSourcingValue: string | null;
  sourcingTimeline: string | null; preferredEngagement: string | null;
};

/** Sourcing profile; fields changed since the last sector approval are highlighted with the approved value. */
export function SourcingProfileView({ req, before }: { req: Profile; before?: ProfileSnapshot | null }) {
  const now: ProfileSnapshot = {
    organisationType: req.organisationType ?? "", procurementInterests: req.procurementInterests ?? "",
    annualSourcingValue: req.annualSourcingValue ?? "", sourcingTimeline: req.sourcingTimeline ?? "", preferredEngagement: req.preferredEngagement ?? "",
  };
  const changes = before ? diffProfile(before, now) : [];
  const changed = (k: keyof ProfileSnapshot) => changes.find((c) => c.field === k);
  const field = (k: keyof ProfileSnapshot, wide?: boolean) => {
    const c = changed(k);
    return (
      <div key={k} className={cn(wide && "sm:col-span-2", c && "-mx-2 rounded-lg border-l-4 border-amber-400 bg-amber-50/40 px-2 py-1.5")}>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {PROFILE_LABELS[k]}
          {c && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">Changed</span>}
        </dt>
        <dd className={cn("mt-1 whitespace-pre-line text-sm text-ink", c && "rounded-md bg-amber-50 px-2 py-1 ring-1 ring-amber-200")}>{now[k] || <span className="text-slate-400">—</span>}</dd>
        {c && c.kind === "text" && (
          <p className="mt-1 whitespace-pre-line text-xs text-slate-500"><span className="font-semibold">Approved: </span><span className="line-through decoration-tx-red/60">{c.before || "(blank)"}</span></p>
        )}
      </div>
    );
  };
  return (
    <Card>
      <CardHeader title="Sourcing profile"
        subtitle={changes.length ? `${changes.length} field${changes.length > 1 ? "s" : ""} changed since the last approval` : undefined} />
      <dl className="grid gap-x-6 gap-y-4 p-6 sm:grid-cols-2">
        {field("organisationType")}
        {field("annualSourcingValue")}
        {field("sourcingTimeline")}
        {field("preferredEngagement")}
        {field("procurementInterests", true)}
      </dl>
    </Card>
  );
}
