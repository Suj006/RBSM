import "server-only";
import type { Prisma, User } from "@/generated/prisma/client";
import type { ConversationKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Communications: who may see and write what.
 * - Buyer–seller discussions: the matched pair (published mapping, once the Directorate enables interaction),
 *   the Directorate and FIEO. Never other buyers or sellers.
 * - Programme desk: one conversation per buyer and per seller with the Directorate / FIEO (open at any time).
 * - Announcements: from the Directorate / FIEO to groups or from a buyer to all its matched sellers; only the
 *   recipients (and the Directorate / FIEO) see them.
 * Admin sees everything, read only. District centres have no access.
 */
export type Viewer = {
  user: User;
  /** Directorate or FIEO: sees everything and can write anywhere. */
  staff: boolean;
  /** Admin: sees everything, cannot write. */
  admin: boolean;
  buyerId: string | null;
  buyerName: string | null;
  sellerId: string | null;
  sellerName: string | null;
};

export async function getViewer(user: User): Promise<Viewer> {
  const staff = user.role === "DIC" || user.role === "FIEO";
  const admin = user.role === "ADMIN";
  const [buyer, seller] = await Promise.all([
    user.role === "BUYER" ? prisma.buyer.findUnique({ where: { userId: user.id }, select: { id: true, name: true } }) : null,
    user.role === "SELLER" ? prisma.seller.findFirst({ where: { userId: user.id, status: "APPROVED" }, select: { id: true, name: true } }) : null,
  ]);
  return { user, staff, admin, buyerId: buyer?.id ?? null, buyerName: buyer?.name ?? null, sellerId: seller?.id ?? null, sellerName: seller?.name ?? null };
}

export const canUseComms = (v: Viewer) => v.staff || v.admin || !!v.buyerId || !!v.sellerId;

/** Conversations a viewer may see. */
export function conversationScope(v: Viewer): Prisma.ConversationWhereInput {
  if (v.staff || v.admin) return {};
  if (v.buyerId) return { buyerId: v.buyerId, kind: { in: ["BUYER_SELLER", "DESK_BUYER"] } };
  if (v.sellerId) return { sellerId: v.sellerId, kind: { in: ["BUYER_SELLER", "DESK_SELLER"] } };
  return { id: "__none__" };
}

/** Announcements a viewer may see: staff / admin all; others those sent to them or by them. */
export function announcementScope(v: Viewer): Prisma.AnnouncementWhereInput {
  if (v.staff || v.admin) return {};
  return { OR: [{ recipients: { some: { userId: v.user.id } } }, { authorId: v.user.id }] };
}

export async function isPublishedPair(buyerId: string, sellerId: string) {
  return !!(await prisma.publishedMatch.findFirst({ where: { buyerId, sellerId }, select: { id: true } }));
}

/** Why a viewer cannot write in a conversation (null = can write). */
export function postBlock(v: Viewer, c: { kind: ConversationKind; closed: boolean }, ctx: { interaction: boolean; published: boolean }): string | null {
  if (v.admin) return "Admin can read communications but not write.";
  if (v.staff) return null;
  if (c.closed) return "This conversation has been closed by the programme team.";
  if (c.kind !== "BUYER_SELLER") return null;
  if (!ctx.published) return "This buyer and seller are not matched in the published mapping.";
  if (!ctx.interaction) return "Buyer–seller discussions are not open yet. The Directorate will enable them after publishing the matchmaking.";
  return null;
}

/** Finds a conversation, creating it on first use. */
export async function ensureConversation(kind: ConversationKind, buyerId: string | null, sellerId: string | null) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.conversation.findFirst({ where: { kind, buyerId, sellerId } });
    return found ?? tx.conversation.create({ data: { kind, buyerId, sellerId } });
  });
}

/** Unread messages per conversation for a viewer (messages by others after the last visit). */
export async function unreadByConversation(v: Viewer, where: Prisma.ConversationWhereInput = {}) {
  const convs = await prisma.conversation.findMany({
    where: { AND: [conversationScope(v), where] },
    select: { id: true, lastMessageAt: true, reads: { where: { userId: v.user.id }, select: { lastReadAt: true } } },
  });
  const stale = convs.filter((c) => !c.reads[0] || c.lastMessageAt > c.reads[0].lastReadAt);
  const out = new Map<string, number>();
  if (!stale.length) return out;
  const msgs = await prisma.message.findMany({
    where: { authorId: { not: v.user.id }, OR: stale.map((c) => ({ conversationId: c.id, createdAt: { gt: c.reads[0]?.lastReadAt ?? new Date(0) } })) },
    select: { conversationId: true },
  });
  for (const m of msgs) out.set(m.conversationId, (out.get(m.conversationId) ?? 0) + 1);
  return out;
}

/** Unread total for the menu badge: unread messages plus unread announcements addressed to the viewer. */
export async function unreadTotal(user: User) {
  const v = await getViewer(user);
  if (!canUseComms(v)) return 0;
  const [byConv, ann] = await Promise.all([
    unreadByConversation(v),
    prisma.announcementRecipient.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return [...byConv.values()].reduce((a, n) => a + n, 0) + ann;
}

export async function markConversationRead(conversationId: string, userId: string) {
  await prisma.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
}

// ---------------------------------------------------------------- audiences

export const AUDIENCES = [
  { value: "ALL_PARTICIPANTS", label: "All buyers and approved sellers" },
  { value: "ALL_BUYERS", label: "All registered buyers (every stage)" },
  { value: "APPROVED_BUYERS", label: "Approved buyers" },
  { value: "APPROVED_SELLERS", label: "Approved sellers" },
  { value: "MATCHED", label: "Buyers and sellers in the published mapping" },
  { value: "ONE_BUYER", label: "One buyer (individual message)" },
  { value: "ONE_SELLER", label: "One seller (individual message)" },
] as const;
export type Audience = (typeof AUDIENCES)[number]["value"];

type Recipient = { userId: string; email: string; name: string };

/** Recipients of a group announcement, with optional sector / district narrowing. */
export async function resolveAudience(a: Audience, opts: { sectorId?: string; district?: string }): Promise<Recipient[]> {
  const sector = opts.sectorId || undefined;
  const buyers = (where: Prisma.BuyerWhereInput) => prisma.buyer.findMany({
    where: { AND: [where, sector ? { requirement: { items: { some: { sectorId: sector, status: "APPROVED" } } } } : {}] },
    select: { userId: true, name: true, signupEmail: true, pocEmail: true },
  }).then((xs) => xs.map((b) => ({ userId: b.userId, email: b.pocEmail || b.signupEmail, name: b.name })));
  const sellers = (where: Prisma.SellerWhereInput) => prisma.seller.findMany({
    where: { AND: [where, { status: "APPROVED", userId: { not: null } }, sector ? { products: { some: { sectorId: sector } } } : {}, opts.district ? { district: opts.district } : {}] },
    select: { userId: true, name: true, contactEmail: true },
  }).then((xs) => xs.map((s) => ({ userId: s.userId!, email: s.contactEmail, name: s.name })));
  const pub = async () => {
    const pairs = await prisma.publishedMatch.findMany({ select: { buyerId: true, sellerId: true } });
    return { b: [...new Set(pairs.map((p) => p.buyerId))], s: [...new Set(pairs.map((p) => p.sellerId))] };
  };
  const noSellers = !!opts.district; // a district narrows to sellers only
  switch (a) {
    case "ALL_PARTICIPANTS": return [...(noSellers ? [] : await buyers({})), ...(await sellers({}))];
    case "ALL_BUYERS": return buyers({});
    case "APPROVED_BUYERS": return buyers({ status: "APPROVED" });
    case "APPROVED_SELLERS": return sellers({});
    case "MATCHED": { const p = await pub(); return [...(noSellers ? [] : await buyers({ id: { in: p.b } })), ...(await sellers({ id: { in: p.s } }))]; }
    default: return [];
  }
}

/** The matched sellers of a buyer in the published mapping (for a buyer's common communication). */
export async function matchedSellersOf(buyerId: string): Promise<Recipient[]> {
  const pairs = await prisma.publishedMatch.findMany({ where: { buyerId }, select: { seller: { select: { userId: true, name: true, contactEmail: true, status: true } } } });
  return pairs.filter((p) => p.seller.userId && p.seller.status === "APPROVED").map((p) => ({ userId: p.seller.userId!, email: p.seller.contactEmail, name: p.seller.name }));
}

/** How a message author is shown. */
export function authorLabel(m: { authorRole: string; author: { displayName: string } }) {
  if (m.authorRole === "DIC") return { name: m.author.displayName, org: "Directorate", tone: "green" as const };
  if (m.authorRole === "FIEO") return { name: m.author.displayName, org: "FIEO", tone: "blue" as const };
  if (m.authorRole === "BUYER") return { name: m.author.displayName, org: "Buyer", tone: "violet" as const };
  if (m.authorRole === "SELLER") return { name: m.author.displayName, org: "Seller", tone: "amber" as const };
  return { name: m.author.displayName, org: m.authorRole, tone: "slate" as const };
}

export const KIND_LABEL: Record<ConversationKind, string> = {
  BUYER_SELLER: "Buyer–seller discussion",
  DESK_BUYER: "Programme desk — buyer",
  DESK_SELLER: "Programme desk — seller",
};

/** Messages written in the last 24 hours. */
export const messagesInLastDay = () => prisma.message.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } });
