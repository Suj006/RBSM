import { Card, CardHeader, DL } from "@/components/ui";

type Profile = {
  organisationType: string | null; procurementInterests: string | null; annualSourcingValue: string | null;
  sourcingTimeline: string | null; preferredEngagement: string | null;
};

export function SourcingProfileView({ req }: { req: Profile }) {
  return (
    <Card>
      <CardHeader title="Sourcing profile" />
      <div className="space-y-5 p-6">
        <DL cols={2} items={[
          { label: "Organisation type", value: req.organisationType },
          { label: "Annual sourcing value", value: req.annualSourcingValue },
          { label: "Sourcing timeline", value: req.sourcingTimeline },
          { label: "Preferred engagement", value: req.preferredEngagement },
        ]} />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Procurement interests</div>
          <p className="mt-1 whitespace-pre-line text-sm text-ink">{req.procurementInterests || "—"}</p>
        </div>
      </div>
    </Card>
  );
}
