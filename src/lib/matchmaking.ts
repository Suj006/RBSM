import "server-only";
import type { MatchSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getTargets } from "@/lib/targets";
import { parseCerts } from "@/lib/format";
import { productKeys } from "@/lib/demand";

/* ------------------------------------------------------------------ state */

export type MatchState = {
  buyersVisible: boolean; // approved sellers can see the buyer directory and give preferences
  prefsFrozen: boolean; // seller preferences closed (Directorate freezes, only Admin reopens)
  locked: boolean; // final mapping locked (Directorate locks, only Admin unlocks)
  version: number; // last published version (0 = never published)
  publishedAt: Date | null;
  generatedAt: Date | null;
  maxPerSeller: number; // 0 = automatic
};

const KEYS = ["buyersVisible", "prefsFrozen", "locked", "version", "publishedAt", "generatedAt", "maxPerSeller"] as const;

export async function getMatchState(): Promise<MatchState> {
  const rows = await prisma.matchSetting.findMany({ where: { key: { in: [...KEYS] } } });
  const v = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    buyersVisible: v("buyersVisible") === "true",
    prefsFrozen: v("prefsFrozen") === "true",
    locked: v("locked") === "true",
    version: Number(v("version") ?? 0),
    publishedAt: v("publishedAt") ? new Date(v("publishedAt")!) : null,
    generatedAt: v("generatedAt") ? new Date(v("generatedAt")!) : null,
    maxPerSeller: Number(v("maxPerSeller") ?? 0),
  };
}

export async function setMatchSetting(key: (typeof KEYS)[number], value: string) {
  await prisma.matchSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function logMatchEvent(action: string, actorId: string | null, detail?: string) {
  await prisma.matchEvent.create({ data: { action, actorId, detail: detail ?? null } });
}

/** Mapping can be edited and published once preferences are frozen and until the list is locked. */
export const canEditMatches = (s: MatchState) => s.prefsFrozen && !s.locked;

/* ------------------------------------------------------------------ the pool */

export type PoolBuyer = {
  id: string; name: string; approvedNo: string | null; country: string; seq: number;
  sectors: { id: string; name: string; products: string; specifications: string | null; certifications: string[]; quantity: string | null; keys: string[] }[];
};
export type PoolSeller = {
  id: string; name: string; approvedNo: string | null; district: string; exportExperience: boolean;
  sectors: { id: string; name: string; products: string; keys: string[] }[];
};

/** Approved buyers (with their approved sectors) and approved sellers — everything matchmaking works on. */
export async function loadPool() {
  const [buyers, sellers, prefs, targets] = await Promise.all([
    prisma.buyer.findMany({
      where: { status: "APPROVED" },
      orderBy: { approvedSeq: "asc" },
      select: {
        id: true, name: true, approvedNo: true, country: true, seq: true,
        requirement: { select: { items: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" },
          select: { products: true, specifications: true, certifications: true, quantity: true, sector: { select: { id: true, name: true } } } } } },
      },
    }),
    prisma.seller.findMany({
      where: { status: "APPROVED" },
      orderBy: { approvedSeq: "asc" },
      select: { id: true, name: true, approvedNo: true, district: true, exportExperience: true,
        products: { orderBy: { sortOrder: "asc" }, select: { products: true, sector: { select: { id: true, name: true } } } } },
    }),
    prisma.sellerPreference.findMany({ select: { sellerId: true, buyerId: true, rank: true } }),
    getTargets(),
  ]);
  const pb: PoolBuyer[] = buyers.map((b) => ({
    id: b.id, name: b.name, approvedNo: b.approvedNo, country: b.country, seq: b.seq,
    sectors: (b.requirement?.items ?? []).map((i) => ({
      id: i.sector.id, name: i.sector.name, products: i.products, specifications: i.specifications,
      certifications: parseCerts(i.certifications), quantity: i.quantity, keys: productKeys(i.products),
    })),
  }));
  const ps: PoolSeller[] = sellers.map((s) => ({
    id: s.id, name: s.name, approvedNo: s.approvedNo, district: s.district, exportExperience: s.exportExperience,
    sectors: s.products.map((p) => ({ id: p.sector.id, name: p.sector.name, products: p.products, keys: productKeys(p.products) })),
  }));
  const prefRank = new Map(prefs.map((p) => [`${p.buyerId}|${p.sellerId}`, p.rank]));
  return { buyers: pb, sellers: ps, prefRank, target: targets.sellersPerBuyer, prefs };
}
export type Pool = Awaited<ReturnType<typeof loadPool>>;

/* ------------------------------------------------------------------ scoring */

export type Fit = { score: number; sectors: string[]; products: string[]; prefRank: number | null };

/**
 * How well a seller fits a buyer (0 = not a candidate):
 * seller preference 60 (rank 1) … 40 (rank 5); common sector 20; each matching product 10 (max 30); export experience 5.
 */
export function fit(b: PoolBuyer, s: PoolSeller, prefRank: number | null): Fit {
  const sectors: string[] = [];
  const products: string[] = [];
  for (const bs of b.sectors) {
    const ss = s.sectors.find((x) => x.id === bs.id);
    if (!ss) continue;
    sectors.push(bs.name);
    for (const k of bs.keys) if (ss.keys.includes(k) && !products.includes(k)) products.push(k);
  }
  if (!sectors.length && !prefRank) return { score: 0, sectors, products, prefRank };
  const score = (prefRank ? 60 - (prefRank - 1) * 5 : 0) + (sectors.length ? 20 : 0) + Math.min(30, products.length * 10) + (s.exportExperience ? 5 : 0);
  return { score, sectors, products, prefRank };
}

/** Buyers one seller may meet: the Directorate's setting, or enough to give every buyer the target (rounded up). */
export function sellerCap(pool: Pool, state: MatchState) {
  if (state.maxPerSeller > 0) return state.maxPerSeller;
  if (!pool.sellers.length) return 1;
  return Math.max(1, Math.ceil((pool.buyers.length * pool.target) / pool.sellers.length));
}

/* ------------------------------------------------------------------ suggestions */

/**
 * Builds suggestions into the draft. Manual additions and removals are always kept.
 * "fill" keeps the current list and only fills buyers up to the target;
 * "rebuild" first drops earlier suggestions (preference / system) and recomputes them.
 * Seller preferences are placed first (rank 1 of every seller before rank 2 …), then the best-fitting sellers,
 * never above the target per buyer or the cap per seller. Only sellers sharing a sector with the buyer are suggested.
 */
export async function generateSuggestions(mode: "fill" | "rebuild") {
  const [pool, state] = await Promise.all([loadPool(), getMatchState()]);
  const cap = sellerCap(pool, state);
  if (mode === "rebuild") await prisma.match.deleteMany({ where: { removed: false, source: { not: "MANUAL" } } });
  const existing = await prisma.match.findMany({ select: { buyerId: true, sellerId: true, removed: true } });
  const taken = new Set(existing.map((m) => `${m.buyerId}|${m.sellerId}`)); // active or removed — never re-suggested
  const perBuyer = new Map<string, number>();
  const perSeller = new Map<string, number>();
  for (const m of existing) if (!m.removed) {
    perBuyer.set(m.buyerId, (perBuyer.get(m.buyerId) ?? 0) + 1);
    perSeller.set(m.sellerId, (perSeller.get(m.sellerId) ?? 0) + 1);
  }
  const candidates: { b: string; s: string; f: Fit }[] = [];
  for (const b of pool.buyers) for (const s of pool.sellers) {
    if (taken.has(`${b.id}|${s.id}`)) continue;
    const f = fit(b, s, pool.prefRank.get(`${b.id}|${s.id}`) ?? null);
    // Only pairs sharing a sector are suggested; a preference outside the buyer's sectors stays a
    // candidate the Directorate can add by hand (it is listed with its preference rank).
    if (f.score > 0 && f.sectors.length) candidates.push({ b: b.id, s: s.id, f });
  }
  candidates.sort((x, y) =>
    (x.f.prefRank ?? 99) - (y.f.prefRank ?? 99) || y.f.score - x.f.score);
  const add: { buyerId: string; sellerId: string; source: MatchSource; score: number }[] = [];
  for (const c of candidates) {
    if ((perBuyer.get(c.b) ?? 0) >= pool.target || (perSeller.get(c.s) ?? 0) >= cap) continue;
    add.push({ buyerId: c.b, sellerId: c.s, source: c.f.prefRank ? "PREFERENCE" : "SYSTEM", score: c.f.score });
    perBuyer.set(c.b, (perBuyer.get(c.b) ?? 0) + 1);
    perSeller.set(c.s, (perSeller.get(c.s) ?? 0) + 1);
  }
  if (add.length) await prisma.match.createMany({ data: add });
  await setMatchSetting("generatedAt", new Date().toISOString());
  return { added: add.length, cap };
}

/* ------------------------------------------------------------------ the board */

export type BoardRow = {
  buyer: PoolBuyer;
  matches: { sellerId: string; seller: PoolSeller; source: MatchSource; fit: Fit; inPublished: boolean }[];
  preferredBy: number; // sellers who listed this buyer as a preference
};

/** Draft mapping per buyer with fit details, plus what differs from the published version. */
export async function loadBoard() {
  const [pool, state, draft, published] = await Promise.all([
    loadPool(), getMatchState(),
    prisma.match.findMany({ where: { removed: false }, select: { buyerId: true, sellerId: true, source: true } }),
    prisma.publishedMatch.findMany({ select: { buyerId: true, sellerId: true } }),
  ]);
  const sellerById = new Map(pool.sellers.map((s) => [s.id, s]));
  const pubSet = new Set(published.map((p) => `${p.buyerId}|${p.sellerId}`));
  const draftSet = new Set(draft.map((d) => `${d.buyerId}|${d.sellerId}`));
  const rows: BoardRow[] = pool.buyers.map((b) => ({
    buyer: b,
    preferredBy: pool.prefs.filter((p) => p.buyerId === b.id).length,
    matches: draft.filter((d) => d.buyerId === b.id && sellerById.has(d.sellerId)).map((d) => {
      const seller = sellerById.get(d.sellerId)!;
      return { sellerId: d.sellerId, seller, source: d.source, fit: fit(b, seller, pool.prefRank.get(`${b.id}|${d.sellerId}`) ?? null), inPublished: pubSet.has(`${b.id}|${d.sellerId}`) };
    }).sort((x, y) => y.fit.score - x.fit.score),
  }));
  const changes = {
    added: draft.filter((d) => !pubSet.has(`${d.buyerId}|${d.sellerId}`)).length,
    removed: published.filter((p) => !draftSet.has(`${p.buyerId}|${p.sellerId}`)).length,
  };
  // Draft rows pointing at buyers/sellers no longer approved (shown by the checks).
  const orphans = draft.filter((d) => !sellerById.has(d.sellerId) || !pool.buyers.some((b) => b.id === d.buyerId)).length;
  return { pool, state, rows, changes, orphans, cap: sellerCap(pool, state) };
}
export type Board = Awaited<ReturnType<typeof loadBoard>>;

/* ------------------------------------------------------------------ checks */

export type Issue = { severity: "high" | "medium" | "low"; kind: string; buyerId?: string; buyer?: string; seller?: string; detail: string };

/** Mappings that look wrong or incomplete. For the Directorate's reference only — they never block publishing. */
export async function matchChecks(board?: Board): Promise<Issue[]> {
  const bd = board ?? await loadBoard();
  const issues: Issue[] = [];
  const draft = await prisma.match.findMany({
    where: { removed: false },
    select: { buyer: { select: { id: true, name: true, status: true } }, seller: { select: { name: true, status: true } } },
  });
  for (const d of draft) {
    if (d.buyer.status !== "APPROVED") issues.push({ severity: "high", kind: "Buyer not approved", buyerId: d.buyer.id, buyer: d.buyer.name, seller: d.seller.name, detail: "The buyer is no longer an approved buyer." });
    if (d.seller.status !== "APPROVED") issues.push({ severity: "high", kind: "Seller not approved", buyerId: d.buyer.id, buyer: d.buyer.name, seller: d.seller.name, detail: "The seller is no longer an approved seller." });
  }
  const load = new Map<string, number>();
  for (const r of bd.rows) for (const m of r.matches) load.set(m.sellerId, (load.get(m.sellerId) ?? 0) + 1);
  for (const r of bd.rows) {
    for (const m of r.matches) {
      if (!m.fit.sectors.length) issues.push({ severity: "high", kind: "No common sector", buyerId: r.buyer.id, buyer: r.buyer.name, seller: m.seller.name,
        detail: `${m.seller.name} offers ${m.seller.sectors.map((s) => s.name).join(", ") || "no sector"}; the buyer's approved sectors are ${r.buyer.sectors.map((s) => s.name).join(", ")}.` });
      else if (!m.fit.products.length) issues.push({ severity: "low", kind: "No matching product", buyerId: r.buyer.id, buyer: r.buyer.name, seller: m.seller.name,
        detail: `Same sector (${m.fit.sectors.join(", ")}) but none of the products named by the buyer.` });
    }
    if (r.matches.length < bd.pool.target) issues.push({ severity: "medium", kind: "Below target", buyerId: r.buyer.id, buyer: r.buyer.name,
      detail: `${r.matches.length} of ${bd.pool.target} sellers mapped.` });
    if (r.matches.length > bd.pool.target) issues.push({ severity: "low", kind: "Above target", buyerId: r.buyer.id, buyer: r.buyer.name,
      detail: `${r.matches.length} sellers mapped (target ${bd.pool.target}).` });
  }
  for (const [sid, n] of load) if (n > bd.cap) {
    const s = bd.pool.sellers.find((x) => x.id === sid)!;
    issues.push({ severity: "medium", kind: "Seller over-assigned", seller: s.name, detail: `${s.name} is mapped to ${n} buyers (limit ${bd.cap} per seller).` });
  }
  const order = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || a.kind.localeCompare(b.kind));
}

/* ------------------------------------------------------------------ preference analysis */

/** Each seller's preferences and whether they made it into the draft and the published mapping. */
export async function preferenceOutcomes() {
  const [prefs, draft, published, sellers] = await Promise.all([
    prisma.sellerPreference.findMany({ orderBy: [{ sellerId: "asc" }, { rank: "asc" }], select: { sellerId: true, buyerId: true, rank: true, buyer: { select: { name: true, approvedNo: true } } } }),
    prisma.match.findMany({ where: { removed: false }, select: { buyerId: true, sellerId: true } }),
    prisma.publishedMatch.findMany({ select: { buyerId: true, sellerId: true } }),
    prisma.seller.findMany({ where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" }, select: { id: true, name: true, approvedNo: true, district: true, prefSubmittedAt: true } }),
  ]);
  const d = new Set(draft.map((m) => `${m.buyerId}|${m.sellerId}`));
  const p = new Set(published.map((m) => `${m.buyerId}|${m.sellerId}`));
  const rows = sellers.map((s) => {
    const mine = prefs.filter((x) => x.sellerId === s.id).map((x) => ({
      rank: x.rank, buyerId: x.buyerId, buyer: x.buyer.name, approvedNo: x.buyer.approvedNo,
      inDraft: d.has(`${x.buyerId}|${s.id}`), inPublished: p.has(`${x.buyerId}|${s.id}`),
    }));
    return { ...s, prefs: mine, honouredDraft: mine.filter((x) => x.inDraft).length, honouredPublished: mine.filter((x) => x.inPublished).length,
      matchedDraft: draft.filter((m) => m.sellerId === s.id).length, matchedPublished: published.filter((m) => m.sellerId === s.id).length };
  });
  const total = prefs.length;
  return {
    rows,
    summary: {
      sellers: sellers.length,
      submitted: sellers.filter((s) => s.prefSubmittedAt).length,
      preferences: total,
      honouredDraft: rows.reduce((n, r) => n + r.honouredDraft, 0),
      honouredPublished: rows.reduce((n, r) => n + r.honouredPublished, 0),
      firstChoiceDraft: rows.filter((r) => r.prefs.some((x) => x.rank === 1 && x.inDraft)).length,
    },
  };
}

/* ------------------------------------------------------------------ published views */

/** The published mapping, buyer by buyer (optionally limited to some buyers or sellers). */
export async function publishedMatches(where: { buyerId?: string; sellerId?: string; sellerDistrict?: string } = {}) {
  return prisma.publishedMatch.findMany({
    where: { buyerId: where.buyerId, sellerId: where.sellerId, seller: where.sellerDistrict ? { district: where.sellerDistrict } : undefined },
    orderBy: [{ buyer: { approvedSeq: "asc" } }, { slot: "asc" }],
    include: {
      buyer: {
        select: { id: true, name: true, approvedNo: true, country: true, pocName: true, pocDesignation: true,
          requirement: { select: { items: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" },
            select: { products: true, specifications: true, certifications: true, quantity: true, sector: { select: { name: true } } } } } } },
      },
      seller: {
        select: { id: true, name: true, approvedNo: true, district: true, exportExperience: true, contactName: true,
          products: { orderBy: { sortOrder: "asc" }, select: { products: true, sector: { select: { name: true } } } } },
      },
    },
  });
}

export const SOURCE_LABEL: Record<MatchSource, string> = { PREFERENCE: "Seller preference", SYSTEM: "System match", MANUAL: "Manual (Directorate)" };

/* ------------------------------------------------------------------ results & gaps */

/** Coverage of the published mapping (or the working list): who and what is left out, for the Directorate's next steps. */
export async function coverage(which: "published" | "draft") {
  const [pool, state, sectors, pairsRaw] = await Promise.all([
    loadPool(), getMatchState(),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    which === "published"
      ? prisma.publishedMatch.findMany({ select: { buyerId: true, sellerId: true, source: true } })
      : prisma.match.findMany({ where: { removed: false }, select: { buyerId: true, sellerId: true, source: true } }),
  ]);
  const sellerById = new Map(pool.sellers.map((s) => [s.id, s]));
  const buyerIds = new Set(pool.buyers.map((b) => b.id));
  const pairs = pairsRaw.filter((p) => sellerById.has(p.sellerId) && buyerIds.has(p.buyerId));
  const byBuyer = new Map<string, string[]>();
  const bySeller = new Map<string, string[]>();
  for (const p of pairs) {
    byBuyer.set(p.buyerId, [...(byBuyer.get(p.buyerId) ?? []), p.sellerId]);
    bySeller.set(p.sellerId, [...(bySeller.get(p.sellerId) ?? []), p.buyerId]);
  }
  const target = pool.target;

  const buyersBelow = pool.buyers.map((b) => ({ id: b.id, name: b.name, approvedNo: b.approvedNo, country: b.country,
    sectors: b.sectors.map((s) => s.name), n: byBuyer.get(b.id)?.length ?? 0 }))
    .filter((b) => b.n < target).map((b) => ({ ...b, shortfall: target - b.n })).sort((a, b) => a.n - b.n);

  const prefSellers = new Set(pool.prefs.map((p) => p.sellerId));
  const sellersWithout = pool.sellers.filter((s) => !bySeller.has(s.id)).map((s) => ({
    id: s.id, name: s.name, approvedNo: s.approvedNo, district: s.district, sectors: s.sectors.map((x) => x.name), gavePreferences: prefSellers.has(s.id),
  }));

  // Sector coverage: demand (approved buyers) vs supply (approved sellers) vs what the mapping uses.
  const sectorRows = sectors.map((sec) => {
    const buyers = pool.buyers.filter((b) => b.sectors.some((s) => s.id === sec.id));
    const sellers = pool.sellers.filter((s) => s.sectors.some((x) => x.id === sec.id));
    const matchedSellers = sellers.filter((s) => bySeller.has(s.id)).length;
    const pairsInSector = pairs.filter((p) => buyers.some((b) => b.id === p.buyerId) && sellerById.get(p.sellerId)!.sectors.some((x) => x.id === sec.id)).length;
    const needed = buyers.length * target;
    const status = !buyers.length && !sellers.length ? null
      : !buyers.length ? "No buyer requirement"
      : !sellers.length ? "No approved seller"
      : sellers.length < needed ? "Short of sellers" : "Covered";
    return { id: sec.id, name: sec.name, buyers: buyers.length, sellers: sellers.length, matchedSellers, unmatchedSellers: sellers.length - matchedSellers, pairs: pairsInSector, needed, status };
  }).filter((r) => r.status);

  // Products a buyer asked for that none of their mapped sellers offers.
  const productGaps: { buyerId: string; buyer: string; sector: string; product: string; availableSellers: number }[] = [];
  for (const b of pool.buyers) {
    const mine = (byBuyer.get(b.id) ?? []).map((id) => sellerById.get(id)!);
    for (const s of b.sectors) for (const k of s.keys) {
      if (mine.some((m) => m.sectors.some((x) => x.id === s.id && x.keys.includes(k)))) continue;
      const available = pool.sellers.filter((x) => x.sectors.some((y) => y.id === s.id && y.keys.includes(k))).length;
      const label = s.products.split(/[,\n;]/).map((x) => x.trim()).find((x) => productKeys(x)[0] === k) ?? k;
      productGaps.push({ buyerId: b.id, buyer: b.name, sector: s.name, product: label, availableSellers: available });
    }
  }

  const districtRows = [...new Set(pool.sellers.map((s) => s.district))].sort().map((d) => {
    const ss = pool.sellers.filter((s) => s.district === d);
    const m = ss.filter((s) => bySeller.has(s.id)).length;
    return { district: d, sellers: ss.length, matched: m, unmatched: ss.length - m, meetings: ss.reduce((n, s) => n + (bySeller.get(s.id)?.length ?? 0), 0) };
  });

  const bySource = (src: string) => pairs.filter((p) => p.source === src).length;
  return {
    which, state, target, pairs: pairs.length,
    buyers: pool.buyers.length, sellers: pool.sellers.length,
    buyersMatched: byBuyer.size, buyersAtTarget: pool.buyers.length - buyersBelow.length,
    sellersMatched: bySeller.size,
    source: { preference: bySource("PREFERENCE"), system: bySource("SYSTEM"), manual: bySource("MANUAL") },
    buyersBelow, sellersWithout, sectorRows, productGaps, districtRows,
    sellersNeeded: buyersBelow.reduce((n, b) => n + b.shortfall, 0),
  };
}
export type Coverage = Awaited<ReturnType<typeof coverage>>;
