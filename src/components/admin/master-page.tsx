import { toggleMasterAction } from "@/app/actions/admin";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { MasterForm } from "./master-form";

type Item = { id: string; name: string; description: string | null; isActive: boolean; sortOrder?: number; usage?: number };

export function MasterPage({ kind, title, subtitle, items }: { kind: "sector" | "certification"; title: string; subtitle: string; items: Item[] }) {
  const withOrder = kind === "sector";
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="mb-6">
        <CardHeader title={`Add ${kind}`} />
        <div className="p-5"><MasterForm kind={kind} withOrder={withOrder} /></div>
      </Card>
      <Card>
        <CardHeader title={`${items.length} ${kind === "sector" ? "sectors" : "certifications"}`}
          subtitle="Inactive entries are hidden from buyers but kept on existing requirements." />
        <ul className="divide-y divide-slate-100">
          {items.map((it) => (
            <li key={it.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
              <div className="flex-1"><MasterForm kind={kind} item={it} withOrder={withOrder} /></div>
              <div className="flex items-center gap-3">
                {typeof it.usage === "number" && <span className="text-xs text-slate-500">{it.usage} buyer rows</span>}
                <Badge tone={it.isActive ? "green" : "slate"}>{it.isActive ? "Active" : "Inactive"}</Badge>
                <form action={toggleMasterAction}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="id" value={it.id} />
                  <input type="hidden" name="isActive" value={String(!it.isActive)} />
                  <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                    {it.isActive ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
