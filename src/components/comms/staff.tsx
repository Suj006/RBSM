import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Headset, Lock, LockOpen, Megaphone, MessageSquarePlus, MessagesSquare, Search, Unplug, Plug } from "lucide-react";
import type { Prisma, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getMatchState } from "@/lib/matchmaking";
import { AUDIENCES, getViewer, KIND_LABEL, markConversationRead, messagesInLastDay, unreadByConversation } from "@/lib/comms";
import { closeConversationAction, staffDirectAction } from "@/app/actions/comms";
import { matchControlAction } from "@/app/actions/matchmaking";
import { DISTRICT_NAMES } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { Alert, Badge, Button, ButtonLink, Card, CardHeader, EmptyState, Input, PageHeader, Select, StatCard } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { ActionButton } from "@/components/match/action-button";
import { AnnouncementForm } from "./announcement-form";
import { Composer } from "./composer";
import { DocList, Thread } from "./thread";
import { RecipientPicker } from "./recipient-picker";
import { cn } from "@/lib/cn";

export type InboxFilters = { kind?: string; q?: string; show?: string; tab?: string };

const KIND_TONE = { BUYER_SELLER: "violet", DESK_BUYER: "blue", DESK_SELLER: "amber" } as const;

function Tabs({ base, tab }: { base: string; tab: string }) {
  return (
    <nav className="mb-5 flex gap-1 border-b border-slate-200 text-sm font-semibold" aria-label="Communications">
      {[["", "Conversations"], ["announcements", "Communications sent"]].map(([k, l]) => (
        <Link key={k} href={`${base}/messages${k ? `?tab=${k}` : ""}`} aria-current={tab === k ? "page" : undefined}
          className={cn("-mb-px border-b-2 px-4 py-2.5", tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-ink")}>{l}</Link>
      ))}
    </nav>
  );
}

/** Directorate / FIEO / Admin: every conversation and communication, with the interaction switch. */
export async function StaffInbox({ user, base, filters }: { user: User; base: string; filters: InboxFilters }) {
  const v = await getViewer(user);
  const tab = filters.tab === "announcements" ? "announcements" : "";
  const state = await getMatchState();
  const [nConv, nMsg, nToday, nDocs, unread] = await Promise.all([
    prisma.conversation.count(), prisma.message.count(), messagesInLastDay(),
    prisma.attachment.count(), unreadByConversation(v),
  ]);
  const totalUnread = [...unread.values()].reduce((a, n) => a + n, 0);

  const header = (
    <>
      <PageHeader eyebrow="Communications" title="Messages & communications"
        subtitle="Every buyer–seller discussion, programme-desk conversation and common communication. Visible to the Directorate and FIEO (Admin: read only) — never to other buyers or sellers."
        actions={<div className="flex flex-wrap gap-2">
          {v.staff && <ButtonLink href={`${base}/messages/new`}><Megaphone className="size-4" /> New communication</ButtonLink>}
          {v.staff && <ButtonLink href={`${base}/messages/new?mode=one`} variant="secondary"><MessageSquarePlus className="size-4" /> Message a buyer / seller</ButtonLink>}
          <DownloadButtons href="/api/reports/communications" label="Communications log" compact />
        </div>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Conversations" value={nConv} accent="blue" />
        <StatCard label="Messages" value={nMsg} accent="green" hint={`${nToday} in the last 24 hours`} />
        <StatCard label="Unread for you" value={totalUnread} accent="red" href={`${base}/messages?show=unread`} />
        <StatCard label="Documents shared" value={nDocs} accent="violet" />
      </div>
      <Card className={cn("mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between", state.interaction ? "ring-2 ring-brand-200" : "")}>
        <div className="flex items-start gap-3">
          <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", state.interaction ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>
            {state.interaction ? <Plug className="size-5" /> : <Unplug className="size-5" />}
          </div>
          <div>
            <div className="font-bold text-ink">Buyer–seller interaction: {state.interaction ? "enabled" : "not enabled"}</div>
            <p className="text-sm text-slate-600">
              {state.interaction ? "Matched buyers and sellers (published mapping) can discuss, share documents, and buyers can write to all their matched sellers."
                : state.version ? "The matchmaking is published. Enable interaction to let matched buyers and sellers discuss."
                : "Available after the matchmaking is published. Programme-desk conversations and communications work at any time."}
            </p>
          </div>
        </div>
        {user.role === "DIC" && state.version > 0 && (
          state.interaction
            ? <ActionButton action={matchControlAction} fields={{ op: "disableInteraction" }} label="Disable interaction"
                confirm="Disable buyer–seller interaction? Existing discussions stay readable but buyers and sellers cannot write to each other." />
            : <ActionButton action={matchControlAction} fields={{ op: "enableInteraction" }} variant="primary" label="Enable interaction" />
        )}
      </Card>
      <Tabs base={base} tab={tab} />
    </>
  );

  if (tab === "announcements") {
    const anns = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 200,
      include: { author: { select: { displayName: true } }, buyer: { select: { name: true } }, _count: { select: { recipients: true, attachments: true } }, recipients: { where: { readAt: { not: null } }, select: { id: true } } } });
    return (
      <>
        {header}
        <Card className="overflow-hidden">
          {anns.length ? (
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2.5 text-left">Subject</th><th className="px-3 py-2.5 text-left">From</th><th className="px-3 py-2.5 text-left">To</th>
                    <th className="px-3 py-2.5 text-right">Read</th><th className="px-3 py-2.5 text-left">Sent</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {anns.map((a) => (
                    <tr key={a.id} className="group hover:bg-brand-50/40">
                      <td className="px-4 py-2.5"><Link href={`${base}/messages/a/${a.id}`} className="font-semibold text-ink hover:text-brand-700">{a.subject}</Link>
                        {a._count.attachments > 0 && <span className="ml-2 text-xs text-slate-500">{a._count.attachments} document{a._count.attachments > 1 ? "s" : ""}</span>}</td>
                      <td className="px-3 py-2.5 text-xs">{a.authorRole === "DIC" ? "Directorate" : a.authorRole === "FIEO" ? "FIEO" : <>Buyer: {a.buyer?.name}</>}<div className="text-slate-500">{a.author.displayName}</div></td>
                      <td className="max-w-64 px-3 py-2.5 text-xs text-slate-600">{a.audienceLabel}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a.recipients.length} / {a._count.recipients}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{fmtDateTime(a.createdAt)}</td>
                      <td className="px-2"><ChevronRight className="size-4 text-slate-300 group-hover:text-brand-700" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={<Megaphone className="size-5" />} title="No communications sent yet" />}
        </Card>
      </>
    );
  }

  // Conversations
  const q = filters.q?.trim();
  const where: Prisma.ConversationWhereInput = {
    AND: [
      filters.kind === "BUYER_SELLER" || filters.kind === "DESK_BUYER" || filters.kind === "DESK_SELLER" ? { kind: filters.kind } : {},
      q ? { OR: [{ buyer: { name: { contains: q } } }, { seller: { name: { contains: q } } }, { messages: { some: { body: { contains: q } } } }, { messages: { some: { attachments: { some: { name: { contains: q } } } } } }] } : {},
      filters.show === "closed" ? { closed: true } : {},
      filters.show === "unread" ? { id: { in: [...unread.keys()] } } : {},
    ],
  };
  const convs = await prisma.conversation.findMany({
    where, orderBy: { lastMessageAt: "desc" }, take: 300,
    include: { buyer: { select: { name: true, country: true } }, seller: { select: { name: true, district: true } }, _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { displayName: true } } } } },
  });
  return (
    <>
      {header}
      <Card className="overflow-hidden">
        <form action={`${base}/messages`} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={filters.q} placeholder="Search buyer, seller, message or document…" className="pl-9" aria-label="Search" />
          </div>
          <Select name="kind" defaultValue={filters.kind ?? ""} aria-label="Type">
            <option value="">All conversations</option>
            <option value="BUYER_SELLER">Buyer–seller discussions</option>
            <option value="DESK_BUYER">Programme desk — buyers</option>
            <option value="DESK_SELLER">Programme desk — sellers</option>
          </Select>
          <Select name="show" defaultValue={filters.show ?? ""} aria-label="Show">
            <option value="">Any status</option>
            <option value="unread">Unread for me</option>
            <option value="closed">Closed</option>
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
        {convs.length ? (
          <ul className="divide-y divide-slate-100">
            {convs.map((c) => {
              const last = c.messages[0];
              const n = unread.get(c.id) ?? 0;
              const title = c.kind === "BUYER_SELLER" ? `${c.buyer?.name} ↔ ${c.seller?.name}` : c.kind === "DESK_BUYER" ? `${c.buyer?.name} (buyer)` : `${c.seller?.name} (seller)`;
              return (
                <li key={c.id}>
                  <Link href={`${base}/messages/c/${c.id}`} className="group flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("truncate text-sm text-ink", n ? "font-bold" : "font-semibold")}>{title}</span>
                        <Badge tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</Badge>
                        {c.closed && <Badge tone="slate">Closed</Badge>}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {last ? <>{last.author.displayName}: {last.hiddenAt ? "(withdrawn)" : last.body || "(document)"}</> : "No messages"} · {c._count.messages} message{c._count.messages === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span className="hidden text-xs text-slate-400 sm:block">{fmtDateTime(c.lastMessageAt)}</span>
                    {n > 0 && <span className="rounded-full bg-tx-red px-2 py-0.5 text-xs font-bold text-white">{n}</span>}
                    <ChevronRight className="size-4 text-slate-300 group-hover:text-brand-700" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState icon={<MessagesSquare className="size-5" />} title="No conversations">{q || filters.kind || filters.show ? "Try changing the filters." : "Conversations appear here when buyers, sellers or the programme team write."}</EmptyState>}
      </Card>
    </>
  );
}

/** One conversation, for the programme team: read, intervene, close / reopen, withdraw messages. */
export async function StaffConversation({ user, base, id, sent }: { user: User; base: string; id: string; sent?: string }) {
  const v = await getViewer(user);
  const c = await prisma.conversation.findUnique({
    where: { id },
    include: { buyer: { select: { id: true, name: true, country: true, approvedNo: true } }, seller: { select: { id: true, name: true, district: true, approvedNo: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { displayName: true } }, attachments: { select: { id: true, name: true, mimeType: true, size: true } } } } },
  });
  if (!c) notFound();
  await markConversationRead(c.id, user.id);
  const [state, published] = await Promise.all([
    getMatchState(),
    c.kind === "BUYER_SELLER" ? prisma.publishedMatch.findFirst({ where: { buyerId: c.buyerId!, sellerId: c.sellerId! }, select: { id: true } }) : null,
  ]);
  const title = c.kind === "BUYER_SELLER" ? `${c.buyer?.name} ↔ ${c.seller?.name}` : c.buyer?.name ?? c.seller?.name ?? "";
  const staffBase = base;
  return (
    <>
      <PageHeader back={{ href: `${base}/messages`, label: "Back to messages" }} eyebrow={KIND_LABEL[c.kind]} title={title}
        subtitle={c.kind === "BUYER_SELLER"
          ? `${c.buyer?.country} buyer and ${c.seller?.district} seller · ${published ? "matched in the published mapping" : "no longer in the published mapping"} · interaction ${state.interaction ? "enabled" : "not enabled"}`
          : "Programme desk — the participant and the Directorate / FIEO"}
        actions={<div className="flex flex-wrap items-center gap-2">
          {c.buyer && <Link href={`${staffBase}/buyers/${c.buyer.id}`} className="text-sm font-semibold text-brand-700 hover:underline">Buyer profile</Link>}
          {c.seller && <Link href={`${staffBase}/sellers/${c.seller.id}`} className="text-sm font-semibold text-brand-700 hover:underline">Seller profile</Link>}
          {c.closed && <Badge tone="slate">Closed</Badge>}
        </div>} />
      {sent && <Alert tone="green" className="mb-6">Message sent.</Alert>}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_300px]">
        <Card className="p-5 sm:p-6">
          <Thread messages={c.messages} viewerId={user.id} moderate={v.staff} />
          <div className="mt-6 border-t border-slate-100 pt-5">
            {v.staff
              ? <Composer fields={{ target: "conversation", conversationId: c.id }} placeholder={c.kind === "BUYER_SELLER" ? "Write in this discussion — both the buyer and the seller will see it…" : "Reply to the participant…"} submitLabel={c.kind === "BUYER_SELLER" ? "Send to both" : "Send"} />
              : <Alert tone="slate">Admin can read communications but not write.</Alert>}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5 text-sm text-slate-600">
            <div className="mb-1 font-bold text-ink">Who sees this</div>
            {c.kind === "BUYER_SELLER" ? <>{c.buyer?.name}, {c.seller?.name}, the Directorate and FIEO (Admin read only). No other buyer or seller.</> : <>{c.buyer?.name ?? c.seller?.name}, the Directorate and FIEO (Admin read only).</>}
          </Card>
          {v.staff && (
            <Card className="p-5">
              <div className="mb-2 font-bold text-ink">{c.closed ? "Closed" : "Open"}</div>
              <p className="mb-3 text-sm text-slate-600">{c.closed ? "The participants can read but not write. The programme team can still write." : "Close to stop the participants from writing; everything stays readable."}</p>
              <ActionButton action={closeConversationAction} fields={{ conversationId: c.id, op: c.closed ? "reopen" : "close" }}
                label={c.closed ? <><LockOpen className="size-4" /> Reopen</> : <><Lock className="size-4" /> Close conversation</>}
                confirm={c.closed ? undefined : "Close this conversation? The participants will not be able to write until it is reopened."} />
            </Card>
          )}
          <Card className="p-5"><DownloadButtons href={`/api/reports/communications?conversationId=${c.id}`} label="This conversation" compact /></Card>
        </div>
      </div>
    </>
  );
}

/** Compose: a common communication to a group, or a message to one buyer / seller (programme desk). */
export async function StaffCompose({ user, base, mode }: { user: User; base: string; mode?: string }) {
  const one = mode === "one";
  const [sectors, buyers, sellers] = await Promise.all([
    prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    one ? prisma.buyer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, country: true, status: true } }) : [],
    one ? prisma.seller.findMany({ where: { status: "APPROVED", userId: { not: null } }, orderBy: { name: "asc" }, select: { id: true, name: true, district: true } }) : [],
  ]);
  void user;
  return (
    <>
      <PageHeader back={{ href: `${base}/messages`, label: "Back to messages" }} eyebrow="Communications"
        title={one ? "Message a buyer or seller" : "New communication"}
        subtitle={one ? "Opens (or continues) the programme-desk conversation with one buyer or seller; they can reply."
          : "A common communication to a group. Only the recipients see it (and the Directorate / FIEO / Admin). Recipients are fixed when it is sent."} />
      <div className="mb-5 flex gap-2 text-sm">
        <ButtonLink href={`${base}/messages/new`} variant={one ? "secondary" : "primary"}><Megaphone className="size-4" /> To a group</ButtonLink>
        <ButtonLink href={`${base}/messages/new?mode=one`} variant={one ? "primary" : "secondary"}><Headset className="size-4" /> To one buyer / seller</ButtonLink>
      </div>
      <Card className="max-w-4xl p-6">
        {one ? (
          <Composer action={staffDirectAction} fields={{ target: "desk" }} submitLabel="Send message" placeholder="Write your message…">
            <RecipientPicker buyers={buyers.map((b) => ({ id: b.id, label: `${b.name} — ${b.country}${b.status === "APPROVED" ? "" : " (in registration)"}` }))}
              sellers={sellers.map((s) => ({ id: s.id, label: `${s.name} — ${s.district}` }))} />
          </Composer>
        ) : (
          <AnnouncementForm audiences={AUDIENCES.filter((a) => a.value !== "ONE_BUYER" && a.value !== "ONE_SELLER").map((a) => ({ value: a.value, label: a.label }))}
            sectors={sectors.map((s) => ({ value: s.id, label: s.name }))} districts={[...DISTRICT_NAMES]} />
        )}
      </Card>
    </>
  );
}

export { DocList };
