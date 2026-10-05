import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileSignature, Search } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import type { MouStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { DISTRICTS } from "@/lib/config";
import { getMouRate, loadMou, MOU_STATUS, mouStage, mouStageShort, fmtMonth, mouWhere, type MouFilters } from "@/lib/mou";
export type { MouFilters };
const STATUSES = Object.keys(MOU_STATUS) as MouStatus[];
import { mouDocument } from "@/lib/mou-doc";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { Flag, UidPill, uid } from "@/components/ids";
import { MouDocumentView } from "./document";
import { MouReview } from "./review";
import { MouValue } from "./participant";
import { cn } from "@/lib/cn";

const INCLUDE = { buyer: { select: { name: true, country: true, approvedNo: true, regNo: true, nodalOfficer: { select: { name: true } } } },
  seller: { select: { name: true, district: true, approvedNo: true, regNo: true } }, sector: { select: { name: true } } } as const;

function MouTable({ rows, base, rate }: { rows: Awaited<ReturnType<typeof prisma.mou.findMany<{ include: typeof INCLUDE }>>>; base: string; rate: number }) {
  if (!rows.length) return <EmptyState icon={<FileSignature className="size-5" />} title="No MoUs found">MoUs appear here as buyers fill them after their meetings.</EmptyState>;
  return (
    <div className="table-scroll relative overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-2.5 text-left">MoU no.</th><th className="px-3 py-2.5 text-left">Buyer</th><th className="px-3 py-2.5 text-left">Seller</th><th className="px-3 py-2.5 text-left">Goods · sector</th>
            <th className="px-3 py-2.5 text-left">Approx. value</th><th className="px-3 py-2.5 text-left">Order month</th><th className="px-3 py-2.5 text-left">Status</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((m) => (
            <tr key={m.id} className="align-top hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-2.5"><Link href={`${base}/${m.id}`} className="font-mono text-xs font-bold text-brand-800 hover:underline">{m.mouNo}</Link><div className="text-[11px] text-slate-400">{fmtDate(m.submittedAt)}</div></td>
              <td className="px-3 py-2.5"><div className="flex items-center gap-1.5 font-semibold text-ink"><Flag country={m.buyer.country} /> {m.buyer.name}</div><UidPill id={uid(m.buyer)} tone="buyer" /></td>
              <td className="px-3 py-2.5"><div className="font-semibold text-ink">{m.seller.name}</div><div className="flex items-center gap-1.5 text-xs text-slate-500"><UidPill id={uid(m.seller)} tone="seller" /> {m.seller.district}</div></td>
              <td className="max-w-64 px-3 py-2.5 text-xs text-slate-600"><div className="line-clamp-2 text-ink">{m.goods}</div>{m.sector?.name}</td>
              <td className="px-3 py-2.5 text-xs"><MouValue m={m} rate={rate} /></td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs">{fmtMonth(m.orderMonth)}</td>
              <td className="whitespace-nowrap px-3 py-2.5"><Badge tone={MOU_STATUS[m.status].tone}>{mouStageShort(m)}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Directorate / FIEO / Admin: every MoU, searchable and filterable. */
export async function MouRegister({ base, filters }: { base: string; filters: MouFilters }) {
  const where = mouWhere(filters);
  const [rows, rate, sectors, countries] = await Promise.all([
    prisma.mou.findMany({ where, orderBy: { seq: "desc" }, take: 500, include: INCLUDE }),
    getMouRate(),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.buyer.findMany({ where: { mous: { some: {} } }, distinct: ["country"], select: { country: true }, orderBy: { country: "asc" } }),
  ]);
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader eyebrow="Memorandum of understanding" title="All MoUs" subtitle={`${rows.length} MoU${rows.length === 1 ? "" : "s"}${qs ? " matching the filters" : ""}. Values in US$ and INR at 1 US$ = ₹ ${rate}.`}
        actions={<DownloadButtons href={`/api/reports/mou-register${qs ? `?${qs}` : ""}`} label="MoU register" compact />} />
      <Card className="overflow-hidden">
        <form action={`${base}/list`} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={filters.q} placeholder="MoU no., buyer / seller name or ID, goods…" className="pl-9" aria-label="Search" /></div>
          <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status"><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{MOU_STATUS[s].label}</option>)}</Select>
          <Select name="country" defaultValue={filters.country ?? ""} aria-label="Country"><option value="">All countries</option>{countries.map((c) => <option key={c.country}>{c.country}</option>)}</Select>
          <Select name="sector" defaultValue={filters.sector ?? ""} aria-label="Sector"><option value="">All sectors</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select name="district" defaultValue={filters.district ?? ""} aria-label="Seller district"><option value="">All districts</option>{DISTRICTS.map((d) => <option key={d.name}>{d.name}</option>)}</Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
        <MouTable rows={rows} base={base} rate={rate} />
      </Card>
    </>
  );
}

/** One MoU for staff and nodal officers: the document, the two checks, and the reviewer's actions. */
export async function MouStaffView({ user, id, base, back }: { user: User; id: string; base: string; back: string }) {
  const m = await loadMou(id);
  if (!m) notFound();
  if (user.role === "NODAL" && m.buyer.nodalOfficer?.userId !== user.id) notFound();
  const doc = await mouDocument(m);
  const open = m.status === "SUBMITTED";
  const can = {
    verify: open && !m.nodalVerifiedAt && (user.role === "NODAL" || user.role === "DIC"),
    approve: open && !m.fieoApprovedAt && user.role === "FIEO",
    ret: open && (user.role === "NODAL" || user.role === "FIEO" || user.role === "DIC"),
  };
  const step = (done: Date | null, by: string | undefined, label: string, who: string) => (
    <div className={cn("rounded-xl p-4 ring-1", done ? "bg-brand-50 ring-brand-200" : "bg-white ring-slate-200")}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-semibold text-ink">{done ? `Done — ${by ?? ""}` : `Pending (${who})`}</div>
      {done && <div className="text-xs text-slate-500">{fmtDateTime(done)}</div>}
    </div>
  );
  return (
    <>
      <PageHeader back={{ href: back, label: "Back" }} eyebrow="Memorandum of understanding" title={m.mouNo}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><Badge tone={MOU_STATUS[m.status].tone}>{m.status === "SUBMITTED" ? mouStage(m) : MOU_STATUS[m.status].label}</Badge>
          <Flag country={m.buyer.country} /> {m.buyer.name} <UidPill id={uid(m.buyer)} tone="buyer" /> ↔ {m.seller.name} <UidPill id={uid(m.seller)} tone="seller" /></span>}
        actions={<a href={`/api/mou/${m.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-slate-300 hover:bg-slate-50"><Download className="size-4 text-brand-700" /> PDF</a>} />
      <Card className="mb-6">
        <CardHeader title="Verification" subtitle="Approved — and shown to the seller — once verified by the nodal officer and approved by FIEO, in any order." />
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {step(m.nodalVerifiedAt, m.nodalVerifiedBy?.displayName, "Nodal officer", m.buyer.nodalOfficer?.name ?? "not assigned — the Directorate can verify")}
          {step(m.fieoApprovedAt, m.fieoApprovedBy?.displayName, "FIEO", "FIEO")}
          <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Buyer submitted</div><div className="font-semibold text-ink">{fmtDateTime(m.submittedAt)}</div>
            {m.meeting && <div className="text-xs text-slate-500">Meeting ticket {m.meeting.ticketNo}</div>}</div>
        </div>
        {m.status === "RETURNED" && <div className="px-5 pb-5"><Alert tone="red" title="Returned to the buyer">&ldquo;{m.returnComment}&rdquo; — {m.returnedBy?.displayName}, {fmtDateTime(m.returnedAt)}</Alert></div>}
        {(can.verify || can.approve || can.ret) && <div className="border-t border-slate-100 p-5"><MouReview mouId={m.id} can={can} /></div>}
      </Card>
      <div className="mx-auto max-w-4xl"><MouDocumentView d={doc} /></div>
      <p className="mx-auto mt-3 max-w-4xl text-xs text-slate-500">Open <Link href={`${base.replace(/\/mou$/, "")}/buyers`} className="text-brand-700 hover:underline">buyers</Link> to see the full profiles.</p>
    </>
  );
}

/** Nodal officer: MoUs of the buyers assigned to them — awaiting their verification first. */
export async function NodalMouList({ user }: { user: User }) {
  const o = await prisma.nodalOfficer.findUnique({ where: { userId: user.id }, select: { id: true, name: true } });
  if (!o) notFound();
  const [rows, rate] = await Promise.all([
    prisma.mou.findMany({ where: { buyer: { nodalOfficerId: o.id } }, orderBy: { seq: "desc" }, include: INCLUDE }),
    getMouRate(),
  ]);
  const pending = rows.filter((m) => m.status === "SUBMITTED" && !m.nodalVerifiedAt);
  return (
    <>
      <PageHeader eyebrow={`Nodal officer · ${o.name}`} title="MoUs to verify"
        subtitle="MoUs filled by your buyers after their meetings. Check them with the buyer and the seller, then verify — or return them with a comment. FIEO approves them too." />
      {pending.length > 0 && <Alert tone="amber" className="mb-6">{pending.length} MoU{pending.length === 1 ? " is" : "s are"} waiting for your verification.</Alert>}
      <Card className="overflow-hidden"><MouTable rows={[...pending, ...rows.filter((m) => !pending.includes(m))]} base="/nodal/mou" rate={rate} /></Card>
    </>
  );
}
