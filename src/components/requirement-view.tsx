import { Card, CardHeader, DL, Badge } from "@/components/ui";
import { parseCerts } from "@/lib/format";

type Req = {
  organisationType: string | null; procurementInterests: string | null; annualSourcingValue: string | null;
  sourcingTimeline: string | null; preferredEngagement: string | null; updatedAt: Date;
  items: { id: string; products: string; specifications: string | null; certifications: string; quantity: string | null; sector: { name: string } }[];
};

export function RequirementView({ req }: { req: Req }) {
  return (
    <div className="space-y-6">
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
      <Card>
        <CardHeader title={`Sectors of interest (${req.items.length})`} />
        <div className="divide-y divide-slate-100">
          {req.items.map((it) => {
            const certs = parseCerts(it.certifications);
            return (
              <div key={it.id} className="grid gap-4 p-6 md:grid-cols-[220px_1fr]">
                <div>
                  <div className="font-bold text-ink">{it.sector.name}</div>
                  {it.quantity && <div className="mt-1 text-xs text-slate-500">Volume: {it.quantity}</div>}
                </div>
                <div className="space-y-3 text-sm">
                  <div><span className="font-semibold text-slate-600">Products: </span>{it.products}</div>
                  {it.specifications && <div className="whitespace-pre-line"><span className="font-semibold text-slate-600">Specifications: </span>{it.specifications}</div>}
                  {certs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{certs.map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>
                  )}
                </div>
              </div>
            );
          })}
          {!req.items.length && <p className="p-6 text-sm text-slate-500">No sectors added.</p>}
        </div>
      </Card>
    </div>
  );
}
