import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Headset, Lock, Megaphone, MessagesSquare } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getMatchState } from "@/lib/matchmaking";
import { announcementScope, getViewer, markConversationRead, matchedSellersOf, postBlock, unreadByConversation } from "@/lib/comms";
import { fmtDateTime } from "@/lib/format";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { AnnouncementForm } from "./announcement-form";
import { Composer } from "./composer";
import { DocList, Thread } from "./thread";
import { cn } from "@/lib/cn";
import { Flag, uid } from "@/components/ids";

const MSG = { orderBy: { createdAt: "asc" as const }, include: { author: { select: { displayName: true } }, attachments: { select: { id: true, name: true, mimeType: true, size: true } } } };

function Row({ href, title, sub, unread, last, icon }: { href: string; title: string; sub?: string; unread?: number; last?: Date | null; icon?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-brand-50/40">
        {icon}
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-sm text-ink", unread ? "font-bold" : "font-semibold")}>{title}</div>
          {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
        </div>
        {last && <span className="hidden text-xs text-slate-400 sm:block">{fmtDateTime(last)}</span>}
        {!!unread && <span className="rounded-full bg-tx-red px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}
        <ChevronRight className="size-4 text-slate-300 group-hover:text-brand-700" />
      </Link>
    </li>
  );
}

/** Messages home for a buyer or an approved seller. */
export async function ParticipantInbox({ user, base }: { user: User; base: "/buyer" | "/seller" }) {
  const v = await getViewer(user);
  if (!v.buyerId && !v.sellerId) redirect(base);
  const isBuyer = !!v.buyerId;
  const [state, unread, desk, convs, pairs, received, sent] = await Promise.all([
    getMatchState(), unreadByConversation(v),
    prisma.conversation.findFirst({ where: isBuyer ? { kind: "DESK_BUYER", buyerId: v.buyerId } : { kind: "DESK_SELLER", sellerId: v.sellerId } }),
    prisma.conversation.findMany({ where: { kind: "BUYER_SELLER", ...(isBuyer ? { buyerId: v.buyerId } : { sellerId: v.sellerId }) },
      include: { buyer: { select: { id: true, name: true, country: true, approvedNo: true, regNo: true } }, seller: { select: { id: true, name: true, district: true, approvedNo: true, regNo: true } } } }),
    prisma.publishedMatch.findMany({ where: isBuyer ? { buyerId: v.buyerId! } : { sellerId: v.sellerId! }, orderBy: { slot: "asc" },
      include: { buyer: { select: { id: true, name: true, country: true, approvedNo: true, regNo: true } }, seller: { select: { id: true, name: true, district: true, approvedNo: true, regNo: true } } } }),
    prisma.announcementRecipient.findMany({ where: { userId: user.id }, orderBy: { announcement: { createdAt: "desc" } },
      include: { announcement: { include: { author: { select: { displayName: true } }, buyer: { select: { name: true } }, _count: { select: { attachments: true } } } } } }),
    isBuyer ? prisma.announcement.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { recipients: true } } } }) : [],
  ]);
  // Counterparts: matched in the published mapping, plus any earlier discussion.
  type Party = { id: string; name: string; approvedNo: string | null; regNo: string };
  const other = (x: { buyer: Party & { country: string } | null; seller: Party & { district: string } | null }) =>
    isBuyer ? { id: x.seller!.id, name: x.seller!.name, sub: `${uid(x.seller!)} · ${x.seller!.district}, Kerala`, country: "" } : { id: x.buyer!.id, name: x.buyer!.name, sub: `${uid(x.buyer!)} · ${x.buyer!.country}`, country: x.buyer!.country };
  const people = new Map<string, { id: string; name: string; sub: string; country: string; conv?: (typeof convs)[number]; matched: boolean }>();
  for (const p of pairs) people.set(other(p).id, { ...other(p), matched: true });
  for (const c of convs) { const o = other(c); people.set(o.id, { ...(people.get(o.id) ?? { ...o, matched: false }), conv: c }); }
  const list = [...people.values()].sort((a, b) => (b.conv?.lastMessageAt?.getTime() ?? 0) - (a.conv?.lastMessageAt?.getTime() ?? 0) || a.name.localeCompare(b.name));
  const counterpart = isBuyer ? "sellers" : "buyers";
  const recipients = isBuyer ? await matchedSellersOf(v.buyerId!) : [];

  return (
    <>
      <PageHeader eyebrow="Communications" title="Messages"
        subtitle={`Discussions with your matched ${counterpart}, the programme desk (Directorate and FIEO), and communications sent to you. Discussions are seen only by you, the other party, the Directorate and FIEO.`} />
      {!state.interaction && (
        <Alert tone="slate" className="mb-6" title={`Discussions with ${counterpart} are not open yet`}>
          They open after the Directorate publishes the matchmaking and enables buyer–seller interaction. You can write to the programme desk at any time.
        </Alert>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title={`Your matched ${counterpart}`} icon={<MessagesSquare className="size-4" />}
              subtitle={state.version ? `From the published matchmaking${state.interaction ? " — open a discussion to ask questions and share documents" : ""}` : "Shown here once the matchmaking is published"} />
            {list.length ? (
              <ul className="divide-y divide-slate-100">
                {list.map((p) => (
                  <Row key={p.id} href={`${base}/messages/${isBuyer ? "seller" : "buyer"}/${p.id}`} title={p.name} icon={p.country ? <Flag country={p.country} className="text-lg" /> : undefined}
                    sub={`${p.sub}${p.matched ? "" : " · no longer in the published mapping"}${p.conv ? "" : " · no messages yet"}`}
                    unread={p.conv ? unread.get(p.conv.id) : 0} last={p.conv?.lastMessageAt} />
                ))}
              </ul>
            ) : <EmptyState icon={<MessagesSquare className="size-5" />} title={`No matched ${counterpart} yet`}>Your matched {counterpart} will be listed here once the matchmaking is published.</EmptyState>}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Communications" icon={<Megaphone className="size-4" />} subtitle="Sent to you by the Directorate, FIEO or a buyer" />
            {received.length ? (
              <ul className="divide-y divide-slate-100">
                {received.map((r) => (
                  <Row key={r.id} href={`${base}/messages/a/${r.announcementId}`} title={r.announcement.subject}
                    sub={`From ${r.announcement.authorRole === "DIC" ? "the Directorate" : r.announcement.authorRole === "FIEO" ? "FIEO" : r.announcement.buyer?.name ?? r.announcement.author.displayName}${r.announcement._count.attachments ? ` · ${r.announcement._count.attachments} document${r.announcement._count.attachments > 1 ? "s" : ""}` : ""}`}
                    unread={r.readAt ? 0 : 1} last={r.announcement.createdAt} />
                ))}
              </ul>
            ) : <p className="px-5 py-6 text-sm text-slate-500">Nothing yet.</p>}
          </Card>
          {isBuyer && sent.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Sent by you to your matched sellers" />
              <ul className="divide-y divide-slate-100">
                {sent.map((a) => <Row key={a.id} href={`${base}/messages/a/${a.id}`} title={a.subject} sub={`${a._count.recipients} sellers`} last={a.createdAt} />)}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="Programme desk" icon={<Headset className="size-4" />} subtitle="Write to the Directorate and FIEO — questions, clarifications, documents" />
            <ul><Row href={`${base}/messages/desk`} title={desk ? "Open conversation" : "Start a conversation"} unread={desk ? unread.get(desk.id) : 0} last={desk?.lastMessageAt} /></ul>
          </Card>
          {isBuyer && (
            <Card>
              <CardHeader title="Write to all your matched sellers" icon={<Megaphone className="size-4" />} />
              <div className="p-5">
                {state.interaction && recipients.length
                  ? <AnnouncementForm recipientsNote={`Goes to all ${recipients.length} of your matched sellers. Each can reply to you in their own discussion; sellers do not see each other's replies.`} />
                  : <p className="text-sm text-slate-500">{state.interaction ? "You have no matched sellers in the published mapping." : "Available once the Directorate enables buyer–seller interaction."}</p>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** A buyer–seller discussion seen by the buyer (otherId = seller) or the seller (otherId = buyer). */
export async function ParticipantPairThread({ user, base, otherId }: { user: User; base: "/buyer" | "/seller"; otherId: string }) {
  const v = await getViewer(user);
  if (!v.buyerId && !v.sellerId) redirect(base);
  const buyerId = v.buyerId ?? otherId, sellerId = v.sellerId ?? otherId;
  const [buyer, seller, state, published, conv] = await Promise.all([
    prisma.buyer.findUnique({ where: { id: buyerId }, select: { name: true, country: true, status: true, approvedNo: true, regNo: true } }),
    prisma.seller.findUnique({ where: { id: sellerId }, select: { name: true, district: true, approvedNo: true, regNo: true } }),
    getMatchState(),
    prisma.publishedMatch.findFirst({ where: { buyerId, sellerId }, select: { id: true } }),
    prisma.conversation.findFirst({ where: { kind: "BUYER_SELLER", buyerId, sellerId }, include: { messages: MSG } }),
  ]);
  if (!buyer || !seller || (!published && !conv)) notFound();
  if (conv) await markConversationRead(conv.id, user.id);
  const block = postBlock(v, { kind: "BUYER_SELLER", closed: conv?.closed ?? false }, { interaction: state.interaction, published: !!published });
  const them = v.buyerId ? `${seller.name} · ${uid(seller)} · ${seller.district}, Kerala` : `${buyer.name} · ${uid(buyer)} · ${buyer.country}`;
  return (
    <>
      <PageHeader back={{ href: `${base}/messages`, label: "Back to messages" }} eyebrow="Buyer–seller discussion" title={v.buyerId ? seller.name : buyer.name}
        subtitle={`${them}. Seen only by you, ${v.buyerId ? "this seller" : "this buyer"}, the Directorate and FIEO.`} />
      <Card className="p-5 sm:p-6">
        <Thread messages={conv?.messages ?? []} viewerId={user.id} moderate={false} />
        <div className="mt-6 border-t border-slate-100 pt-5">
          {block ? <Alert tone="slate"><span className="inline-flex items-center gap-1.5"><Lock className="size-4" /> {block}</span></Alert>
            : <Composer fields={{ target: "pair", [v.buyerId ? "sellerId" : "buyerId"]: otherId }} placeholder={`Write to ${v.buyerId ? seller.name : buyer.name}…`} />}
        </div>
      </Card>
    </>
  );
}

/** The participant's conversation with the programme team. */
export async function ParticipantDesk({ user, base }: { user: User; base: "/buyer" | "/seller" }) {
  const v = await getViewer(user);
  if (!v.buyerId && !v.sellerId) redirect(base);
  const conv = await prisma.conversation.findFirst({ where: v.buyerId ? { kind: "DESK_BUYER", buyerId: v.buyerId } : { kind: "DESK_SELLER", sellerId: v.sellerId }, include: { messages: MSG } });
  if (conv) await markConversationRead(conv.id, user.id);
  const block = conv ? postBlock(v, conv, { interaction: true, published: true }) : null;
  return (
    <>
      <PageHeader back={{ href: `${base}/messages`, label: "Back to messages" }} eyebrow="Programme desk" title="Directorate and FIEO"
        subtitle="Ask the programme team anything about the event, your registration or your meetings. Only you and the programme team see this conversation." />
      <Card className="p-5 sm:p-6">
        <Thread messages={conv?.messages ?? []} viewerId={user.id} moderate={false} />
        <div className="mt-6 border-t border-slate-100 pt-5">
          {block ? <Alert tone="slate">{block}</Alert> : <Composer fields={{ target: "desk" }} placeholder="Write to the programme team…" />}
        </div>
      </Card>
    </>
  );
}

/** One communication (announcement). Marks it read for a recipient; staff and the sender see who has read it. */
export async function AnnouncementView({ user, base, id, sent, back }: { user: User; base: string; id: string; sent?: string; back?: string }) {
  const v = await getViewer(user);
  const a = await prisma.announcement.findFirst({
    where: { AND: [{ id }, announcementScope(v)] },
    include: { author: { select: { displayName: true } }, buyer: { select: { name: true } }, attachments: { select: { id: true, name: true, mimeType: true, size: true } },
      recipients: { include: { user: { select: { displayName: true, role: true } } }, orderBy: { user: { displayName: "asc" } } } },
  });
  if (!a) notFound();
  const mine = a.recipients.find((r) => r.userId === user.id);
  if (mine && !mine.readAt) await prisma.announcementRecipient.update({ where: { id: mine.id }, data: { readAt: new Date() } });
  const showRecipients = v.staff || v.admin || a.authorId === user.id;
  const read = a.recipients.filter((r) => r.readAt).length;
  const from = a.authorRole === "DIC" ? `Directorate (${a.author.displayName})` : a.authorRole === "FIEO" ? `FIEO (${a.author.displayName})` : a.buyer?.name ?? a.author.displayName;
  return (
    <>
      <PageHeader back={{ href: back ?? `${base}/messages`, label: "Back to messages" }} eyebrow="Communication" title={a.subject}
        subtitle={`From ${from} · ${fmtDateTime(a.createdAt)}${showRecipients ? ` · to ${a.audienceLabel}` : ""}`} />
      {sent && <Alert tone="green" className="mb-6">Sent to {sent} recipient{sent === "1" ? "" : "s"}.</Alert>}
      <div className={cn("grid items-start gap-6", showRecipients && "lg:grid-cols-[1fr_340px]")}>
        <Card className="p-6">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800">{a.body}</p>
          <DocList docs={a.attachments} />
          {!v.staff && !v.admin && a.authorRole !== "BUYER" && (
            <p className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-500">Questions? <Link href={`${base}/messages/desk`} className="font-semibold text-brand-700 hover:underline">Write to the programme desk</Link>.</p>
          )}
          {!v.staff && !v.admin && a.authorRole === "BUYER" && a.buyerId && v.sellerId && (
            <p className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-500">Reply privately to {a.buyer?.name} in <Link href={`${base}/messages/buyer/${a.buyerId}`} className="font-semibold text-brand-700 hover:underline">your discussion with this buyer</Link>.</p>
          )}
        </Card>
        {showRecipients && (
          <Card className="overflow-hidden">
            <CardHeader title={`Recipients (${a.recipients.length})`} subtitle={`${read} read · ${a.recipients.length - read} not yet`} />
            <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
              {a.recipients.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-2 text-sm">
                  <span className="truncate">{r.user.displayName} <span className="text-xs text-slate-400">{r.user.role === "BUYER" ? "Buyer" : "Seller"}</span></span>
                  {r.readAt ? <Badge tone="green">Read</Badge> : <Badge tone="slate">Unread</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
