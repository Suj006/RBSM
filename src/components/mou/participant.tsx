import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, FilePlus2, FileSignature } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { fmtDay, fmtTime } from "@/lib/event";
import { fmtInr, fmtMonth, fmtUsd, getMouRate, loadMou, MOU_STATUS, mouPartners, mouStage, toMoney } from "@/lib/mou";
import { mouDocument } from "@/lib/mou-doc";
import { withdrawMouAction } from "@/app/actions/mou";
import { Alert, Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/match/action-button";
import { Flag, UidPill, uid } from "@/components/ids";
import { MouDocumentView } from "./document";
import { MouForm, type PartnerOption } from "./mou-form";

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export function MouValue({ m, rate }: { m: { amount: number | null; currency: string }; rate: number }) {
  const v = toMoney(m, rate);
  if (!v) return <span className="text-slate-500">To be determined</span>;
  return <span className="whitespace-nowrap"><b className="text-ink">{m.currency === "USD" ? fmtUsd(v.usd) : fmtInr(v.inr)}</b> <span className="text-xs text-slate-500">≈ {m.currency === "USD" ? fmtInr(v.inr) : fmtUsd(v.usd)}</span></span>;
}

async function partnerOptions(buyerId: string): Promise<PartnerOption[]> {
  return (await mouPartners(buyerId)).map((p) => ({
    id: p.id, label: `${p.name} (${p.approvedNo ?? p.regNo}, ${p.district})`,
    sectors: p.products.map((x) => x.sector), common: p.commonSectors.map((c) => c.id),
    meeting: p.meeting ? `${fmtDay(p.meeting.day)} ${fmtTime(p.meeting.startAt)}` : null,
  }));
}

/** Buyer / seller: their MoUs. Sellers see only approved ones. */
export async function MouList({ user }: { user: User }) {
  const isBuyer = user.role === "BUYER";
  const who = isBuyer ? await prisma.buyer.findUnique({ where: { userId: user.id }, select: { id: true, status: true } })
    : await prisma.seller.findFirst({ where: { userId: user.id, status: "APPROVED" }, select: { id: true, status: true } });
  if (!who) redirect(isBuyer ? "/buyer" : "/seller");
  const base = isBuyer ? "/buyer/mou" : "/seller/mou";
  const [rows, rate] = await Promise.all([
    prisma.mou.findMany({ where: isBuyer ? { buyerId: who.id } : { sellerId: who.id, status: "APPROVED" }, orderBy: { seq: "desc" },
      include: { buyer: { select: { name: true, country: true, approvedNo: true, regNo: true } }, seller: { select: { name: true, district: true, approvedNo: true, regNo: true } }, sector: { select: { name: true } } } }),
    getMouRate(),
  ]);
  const canAdd = isBuyer && who.status === "APPROVED";
  return (
    <>
      <PageHeader eyebrow="Memorandum of understanding" title="MoUs"
        subtitle={isBuyer ? "After a successful meeting, record your intention to place an order with the seller. The nodal officer and FIEO verify it; the approved MoU can be downloaded by you and the seller." : "MoUs with buyers, approved by the nodal officer and FIEO. Download them for your records."}
        actions={canAdd ? <ButtonLink href={`${base}/new`}><FilePlus2 className="size-4" /> New MoU</ButtonLink> : undefined} />
      {isBuyer && !canAdd && <Alert tone="slate" className="mb-6">MoUs open once you are an approved buyer.</Alert>}
      {!rows.length ? (
        <Card><EmptyState icon={<FileSignature className="size-5" />} title={isBuyer ? "No MoUs yet" : "No approved MoUs yet"}>
          {isBuyer ? "Fill one after a successful meeting with a seller — only the goods, the approximate value and the month of the order are needed." : "MoUs a buyer signs with you appear here once approved."}
        </EmptyState></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((m) => (
            <Link key={m.id} href={`${base}/${m.id}`} className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:ring-brand-300">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold text-brand-800">{m.mouNo}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-bold text-ink">
                    {isBuyer ? <>{m.seller.name} <UidPill id={uid(m.seller)} tone="seller" /></> : <><Flag country={m.buyer.country} /> {m.buyer.name} <UidPill id={uid(m.buyer)} tone="buyer" /></>}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{m.goods}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500"><span>{m.sector?.name}</span><span>Order: {fmtMonth(m.orderMonth)}</span><MouValue m={m} rate={rate} /></div>
                </div>
                <div className="text-right"><Badge tone={MOU_STATUS[m.status].tone}>{m.status === "SUBMITTED" ? mouStage(m) : MOU_STATUS[m.status].label}</Badge><div className="mt-1 text-xs text-slate-400">{fmtDate(m.approvedAt ?? m.submittedAt)}</div></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/** Buyer: new MoU. */
export async function MouNew({ user, sellerId }: { user: User; sellerId?: string }) {
  const buyer = await prisma.buyer.findUnique({ where: { userId: user.id }, select: { id: true, status: true } });
  if (!buyer || buyer.status !== "APPROVED") redirect("/buyer/mou");
  const partners = await partnerOptions(buyer.id);
  return (
    <>
      <PageHeader back={{ href: "/buyer/mou", label: "Back to MoUs" }} eyebrow="Memorandum of understanding" title="New MoU"
        subtitle="Fill only the goods, the approximate value (US$ or INR) and the month you expect to place the order. Your and the seller's names, IDs, addresses, the meeting and the event are filled in on the MoU automatically." />
      {!partners.length ? <Alert tone="slate">MoUs can be made with your matched sellers, once the matchmaking is published.</Alert>
        : <MouForm partners={partners} initial={{ sellerId }} minMonth={thisMonth()} base="/buyer/mou" />}
    </>
  );
}

/** Buyer / seller: one MoU — the document, its status, download; the buyer corrects or withdraws it while not approved. */
export async function MouView({ user, id, saved }: { user: User; id: string; saved?: boolean }) {
  const isBuyer = user.role === "BUYER";
  const m = await loadMou(id);
  if (!m) notFound();
  const mine = isBuyer ? (await prisma.buyer.findUnique({ where: { userId: user.id }, select: { id: true } }))?.id === m.buyerId
    : m.status === "APPROVED" && (await prisma.seller.findFirst({ where: { userId: user.id }, select: { id: true } }))?.id === m.sellerId;
  if (!mine) notFound();
  const [doc, partners] = await Promise.all([mouDocument(m), isBuyer && m.status === "RETURNED" ? partnerOptions(m.buyerId) : Promise.resolve([])]);
  const base = isBuyer ? "/buyer/mou" : "/seller/mou";
  return (
    <>
      <PageHeader back={{ href: base, label: "Back to MoUs" }} eyebrow="Memorandum of understanding" title={m.mouNo}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><Badge tone={MOU_STATUS[m.status].tone}>{m.status === "SUBMITTED" ? mouStage(m) : MOU_STATUS[m.status].label}</Badge>{isBuyer ? m.seller.name : m.buyer.name}</span>}
        actions={<a href={`/api/mou/${m.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-slate-300 hover:bg-slate-50"><Download className="size-4 text-brand-700" /> Download PDF</a>} />
      {saved && <Alert tone="green" className="mb-6">MoU {m.mouNo} submitted. The nodal officer and FIEO will verify it.</Alert>}
      {m.status === "APPROVED" && <Alert tone="green" className="mb-6" title="Approved memorandum of understanding">Verified by the nodal officer and approved by FIEO. Download it for your records.</Alert>}
      {m.status === "RETURNED" && <Alert tone="red" className="mb-6" title="Returned for correction">&ldquo;{m.returnComment}&rdquo; — {m.returnedBy?.displayName}, {fmtDate(m.returnedAt)}</Alert>}
      {isBuyer && m.status === "RETURNED" && (
        <div className="mb-8"><MouForm partners={partners} base="/buyer/mou" minMonth={thisMonth()}
          initial={{ mouId: m.id, sellerId: m.sellerId, sectorId: m.sectorId ?? "", goods: m.goods, currency: m.currency, amount: m.amount === null ? "" : String(m.amount), tbd: m.amount === null, orderMonth: m.orderMonth }} /></div>
      )}
      <div className="mx-auto max-w-4xl"><MouDocumentView d={doc} /></div>
      {isBuyer && (m.status === "SUBMITTED" || m.status === "RETURNED") && (
        <div className="mx-auto mt-4 flex max-w-4xl justify-end">
          <ActionButton action={withdrawMouAction} fields={{ mouId: m.id }} variant="ghost" label="Withdraw this MoU" confirm={`Withdraw ${m.mouNo}?`} />
        </div>
      )}
    </>
  );
}
