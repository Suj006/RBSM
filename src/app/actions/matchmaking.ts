"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  canEditMatches, fit, generateSuggestions, getMatchState, loadPool, logMatchEvent, setMatchSetting,
} from "@/lib/matchmaking";
import { matchMail, sendMail } from "@/lib/mail";
import type { FormState } from "./auth";

const revalidateAll = () => {
  for (const p of ["/dic", "/admin", "/fieo", "/district", "/seller", "/buyer"]) revalidatePath(p, "layout");
};

const NOT_EDITABLE = "The mapping can be changed only after seller preferences are frozen, and not after the list is locked.";

/** Directorate / Admin controls for the whole matchmaking process. */
export async function matchControlAction(_: FormState, form: FormData): Promise<FormState> {
  const op = String(form.get("op") ?? "");
  const adminOps = ["unfreeze", "unlock"];
  const user = await requireUser(adminOps.includes(op) ? "ADMIN" : "DIC");
  const state = await getMatchState();
  const done = (message: string): FormState => { revalidateAll(); return { ok: true, message }; };

  switch (op) {
    case "showBuyers":
    case "hideBuyers": {
      const on = op === "showBuyers";
      await setMatchSetting("buyersVisible", String(on));
      await logMatchEvent(on ? "Buyer directory opened to sellers" : "Buyer directory hidden from sellers", user.id);
      return done(on ? "Approved sellers can now see the buyer directory and give their preferences." : "The buyer directory is now hidden from sellers.");
    }
    case "freeze": {
      if (state.prefsFrozen) return { error: "Preferences are already frozen." };
      await setMatchSetting("prefsFrozen", "true");
      await logMatchEvent("Seller preferences frozen", user.id);
      return done("Seller preferences are frozen. Sellers can no longer give or change preferences; you can now build and edit the mapping.");
    }
    case "unfreeze": {
      if (!state.prefsFrozen) return { error: "Preferences are not frozen." };
      await setMatchSetting("prefsFrozen", "false");
      await logMatchEvent("Seller preferences reopened (Admin)", user.id);
      return done("Seller preferences are open again. The Directorate can freeze them again after the necessary changes.");
    }
    case "setCap": {
      const n = Number(form.get("cap"));
      if (!Number.isInteger(n) || n < 0 || n > 100) return { fieldErrors: { cap: "Enter a whole number from 0 to 100 (0 = automatic)." } };
      await setMatchSetting("maxPerSeller", String(n));
      await logMatchEvent("Buyers per seller limit set", user.id, n ? String(n) : "automatic");
      return done(n ? `Each seller can now be mapped to at most ${n} buyers.` : "Buyers per seller limit set to automatic.");
    }
    case "fill":
    case "rebuild": {
      if (!canEditMatches(state)) return { error: NOT_EDITABLE };
      const r = await generateSuggestions(op);
      await logMatchEvent(op === "fill" ? "Suggestions filled up to target" : "Suggestions rebuilt", user.id, `${r.added} added`);
      return done(`${r.added} suggestion${r.added === 1 ? "" : "s"} added (seller preferences first, then best fit; at most ${r.cap} buyers per seller). Manual additions and removals were kept.`);
    }
    case "publish": {
      if (!canEditMatches(state)) return { error: NOT_EDITABLE };
      const [draft, before] = await Promise.all([
        prisma.match.findMany({ where: { removed: false }, orderBy: [{ buyerId: "asc" }, { score: "desc" }] }),
        prisma.publishedMatch.findMany({ select: { buyerId: true, sellerId: true } }),
      ]);
      if (!draft.length) return { error: "There is nothing to publish yet — build the mapping first." };
      const version = state.version + 1;
      const slot = new Map<string, number>();
      await prisma.$transaction([
        prisma.publishedMatch.deleteMany({}),
        prisma.publishedMatch.createMany({
          data: draft.map((m) => {
            const n = (slot.get(m.buyerId) ?? 0) + 1;
            slot.set(m.buyerId, n);
            return { version, buyerId: m.buyerId, sellerId: m.sellerId, source: m.source, score: m.score, slot: n };
          }),
        }),
      ]);
      await setMatchSetting("version", String(version));
      await setMatchSetting("publishedAt", new Date().toISOString());
      await logMatchEvent(`Mapping published (version ${version})`, user.id, `${draft.length} pairs`);

      // Tell buyers and sellers whose list is new or changed.
      const key = (b: string, s: string) => `${b}|${s}`;
      const old = new Set(before.map((p) => key(p.buyerId, p.sellerId)));
      const now = new Set(draft.map((p) => key(p.buyerId, p.sellerId)));
      const touched = (pick: (k: string) => string) =>
        new Set([...now].filter((k) => !old.has(k)).concat([...old].filter((k) => !now.has(k))).map(pick));
      const buyers = touched((k) => k.split("|")[0]);
      const sellers = touched((k) => k.split("|")[1]);
      const [bRows, sRows] = await Promise.all([
        prisma.buyer.findMany({ where: { id: { in: [...buyers] } }, select: { id: true, name: true, pocEmail: true, signupEmail: true } }),
        prisma.seller.findMany({ where: { id: { in: [...sellers] } }, select: { id: true, name: true, contactEmail: true } }),
      ]);
      for (const b of bRows) {
        const m = matchMail.published(b.name, "buyer", draft.filter((d) => d.buyerId === b.id).length, version > 1);
        await sendMail(b.pocEmail ?? b.signupEmail, m.subject, m.text);
      }
      for (const s of sRows) {
        const m = matchMail.published(s.name, "seller", draft.filter((d) => d.sellerId === s.id).length, version > 1);
        await sendMail(s.contactEmail, m.subject, m.text);
      }
      return done(`Version ${version} published: ${draft.length} buyer–seller pairs. It is now visible to buyers, sellers, FIEO and district centres; ${bRows.length + sRows.length} affected participant${bRows.length + sRows.length === 1 ? "" : "s"} were e-mailed.`);
    }
    case "lock": {
      if (state.locked) return { error: "The mapping is already locked." };
      if (!state.version) return { error: "Publish the mapping before locking it." };
      await setMatchSetting("locked", "true");
      await logMatchEvent(`Final mapping locked (version ${state.version})`, user.id);
      return done(`Version ${state.version} is locked as final. Only Admin can unlock it.`);
    }
    case "unlock": {
      if (!state.locked) return { error: "The mapping is not locked." };
      await setMatchSetting("locked", "false");
      await logMatchEvent("Final mapping unlocked (Admin)", user.id);
      return done("The mapping is unlocked. The Directorate can make changes and republish, then lock again.");
    }
  }
  return { error: "Unknown action." };
}

/** Directorate: add or remove one buyer–seller pair in the draft. */
export async function mapPairAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("DIC");
  const state = await getMatchState();
  if (!canEditMatches(state)) return { error: NOT_EDITABLE };
  const op = String(form.get("op"));
  const buyerId = String(form.get("buyerId") ?? "");
  const sellerId = String(form.get("sellerId") ?? "");
  const [buyer, seller] = await Promise.all([
    prisma.buyer.findUnique({ where: { id: buyerId }, select: { name: true, status: true } }),
    prisma.seller.findUnique({ where: { id: sellerId }, select: { name: true, status: true } }),
  ]);
  if (!buyer || !seller) return { error: "Buyer or seller not found." };
  if (op === "remove") {
    await prisma.match.updateMany({ where: { buyerId, sellerId }, data: { removed: true } });
    await logMatchEvent("Pair removed", user.id, `${buyer.name} – ${seller.name}`);
    revalidateAll();
    return { ok: true, message: `${seller.name} removed from ${buyer.name}.` };
  }
  if (buyer.status !== "APPROVED" || seller.status !== "APPROVED") return { error: "Only approved buyers and approved sellers can be mapped." };
  const pool = await loadPool();
  const b = pool.buyers.find((x) => x.id === buyerId);
  const s = pool.sellers.find((x) => x.id === sellerId);
  const score = b && s ? fit(b, s, pool.prefRank.get(`${buyerId}|${sellerId}`) ?? null).score : 0;
  await prisma.match.upsert({
    where: { buyerId_sellerId: { buyerId, sellerId } },
    create: { buyerId, sellerId, source: "MANUAL", score },
    update: { removed: false, source: "MANUAL", score },
  });
  await logMatchEvent("Pair added manually", user.id, `${buyer.name} – ${seller.name}`);
  revalidateAll();
  return { ok: true, message: `${seller.name} added to ${buyer.name}.` };
}

/** Seller: submit up to 5 preferred buyers in order. Final — cannot be changed afterwards. */
export async function submitPreferencesAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("SELLER");
  const [seller, state] = await Promise.all([prisma.seller.findUnique({ where: { userId: user.id } }), getMatchState()]);
  if (!seller || seller.status !== "APPROVED") return { error: "Only approved sellers can give preferences." };
  if (!state.buyersVisible) return { error: "The buyer directory is not open yet." };
  if (state.prefsFrozen) return { error: "The preference window has been closed by the Directorate." };
  if (seller.prefSubmittedAt) return { error: "You have already submitted your preferences." };
  if (form.get("ack") !== "on") return { error: "Please tick the box to confirm that you understand the preferences are final once submitted." };
  const ids = form.getAll("buyerIds").map(String).filter(Boolean);
  if (!ids.length) return { error: "Choose at least one buyer." };
  if (ids.length > 5) return { error: "You can choose at most 5 buyers." };
  if (new Set(ids).size !== ids.length) return { error: "Each buyer can be chosen only once." };
  const ok = await prisma.buyer.count({ where: { id: { in: ids }, status: "APPROVED" } });
  if (ok !== ids.length) return { error: "Choose from the approved buyers listed." };
  const saved = await prisma.$transaction(async (tx) => {
    const fresh = await tx.seller.findUnique({ where: { id: seller.id }, select: { prefSubmittedAt: true } });
    if (fresh?.prefSubmittedAt) return false;
    await tx.sellerPreference.createMany({ data: ids.map((buyerId, i) => ({ sellerId: seller.id, buyerId, rank: i + 1 })) });
    await tx.seller.update({ where: { id: seller.id }, data: { prefSubmittedAt: new Date() } });
    return true;
  });
  if (!saved) return { error: "You have already submitted your preferences." };
  await logMatchEvent("Seller preferences submitted", user.id, `${seller.name}: ${ids.length}`);
  revalidateAll();
  return { ok: true, message: "Your preferences have been submitted. Thank you." };
}

/** Directorate / Admin: let one seller submit preferences again (only while preferences are open). */
export async function reopenPreferencesAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["DIC", "ADMIN"]);
  const state = await getMatchState();
  if (state.prefsFrozen) return { error: "Preferences are frozen. Admin must reopen preferences first." };
  const sellerId = String(form.get("sellerId") ?? "");
  const seller = await prisma.seller.findUnique({ where: { id: sellerId }, select: { name: true } });
  if (!seller) return { error: "Seller not found." };
  await prisma.$transaction([
    prisma.sellerPreference.deleteMany({ where: { sellerId } }),
    prisma.seller.update({ where: { id: sellerId }, data: { prefSubmittedAt: null } }),
  ]);
  await logMatchEvent("Seller preferences reopened", user.id, seller.name);
  revalidateAll();
  return { ok: true, message: `${seller.name} can submit preferences again.` };
}
