// Snapshots of a sector requirement / sourcing profile, and the comparison used
// to show reviewers exactly what a buyer changed on resubmission.

export type ItemSnapshot = {
  sectorId: string; sectorName: string; products: string; specifications: string; certifications: string[]; quantity: string;
};
export type ProfileSnapshot = {
  organisationType: string; procurementInterests: string; annualSourcingValue: string; sourcingTimeline: string; preferredEngagement: string;
};

export function itemSnapshot(i: {
  sectorId: string; products: string; specifications: string | null; certifications: string; quantity: string | null;
}, sectorName: string): string {
  let certs: string[] = [];
  try { const v = JSON.parse(i.certifications); if (Array.isArray(v)) certs = v.filter((x) => typeof x === "string"); } catch { /* none */ }
  const s: ItemSnapshot = { sectorId: i.sectorId, sectorName, products: i.products, specifications: i.specifications ?? "", certifications: certs, quantity: i.quantity ?? "" };
  return JSON.stringify(s);
}

export function profileSnapshot(r: {
  organisationType: string | null; procurementInterests: string | null; annualSourcingValue: string | null; sourcingTimeline: string | null; preferredEngagement: string | null;
}): string {
  const s: ProfileSnapshot = {
    organisationType: r.organisationType ?? "", procurementInterests: r.procurementInterests ?? "", annualSourcingValue: r.annualSourcingValue ?? "",
    sourcingTimeline: r.sourcingTimeline ?? "", preferredEngagement: r.preferredEngagement ?? "",
  };
  return JSON.stringify(s);
}

export function parseSnapshot<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

// ---------------------------------------------------------------- comparison

export type TextChange = { kind: "text"; before: string; after: string };
export type ListChange = { kind: "list"; added: string[]; removed: string[]; kept: string[] };
export type Change = { field: string; label: string } & (TextChange | ListChange);

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const splitList = (s: string) => s.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);

/** Item-by-item comparison of comma-separated / array lists (case-insensitive). */
export function listChange(before: string[], after: string[]): ListChange | null {
  const b = new Map(before.map((x) => [norm(x), x]));
  const a = new Map(after.map((x) => [norm(x), x]));
  const added = [...a.keys()].filter((k) => !b.has(k)).map((k) => a.get(k)!);
  const removed = [...b.keys()].filter((k) => !a.has(k)).map((k) => b.get(k)!);
  if (!added.length && !removed.length) return null;
  return { kind: "list", added, removed, kept: [...a.keys()].filter((k) => b.has(k)).map((k) => a.get(k)!) };
}

const textChange = (before: string, after: string): TextChange | null =>
  norm(before) === norm(after) ? null : { kind: "text", before, after };

export function diffItem(before: ItemSnapshot, after: ItemSnapshot): Change[] {
  const out: Change[] = [];
  const push = (field: string, label: string, c: TextChange | ListChange | null) => { if (c) out.push({ field, label, ...c }); };
  if (before.sectorId !== after.sectorId) push("sector", "Sector", { kind: "text", before: before.sectorName, after: after.sectorName });
  push("products", "Products", listChange(splitList(before.products), splitList(after.products)));
  push("specifications", "Specifications", textChange(before.specifications, after.specifications));
  push("certifications", "Certifications", listChange(before.certifications, after.certifications));
  push("quantity", "Indicative volume", textChange(before.quantity, after.quantity));
  return out;
}

export const PROFILE_LABELS: Record<keyof ProfileSnapshot, string> = {
  organisationType: "Organisation type",
  annualSourcingValue: "Annual sourcing value",
  sourcingTimeline: "Sourcing timeline",
  preferredEngagement: "Preferred engagement",
  procurementInterests: "Procurement interests",
};

export function diffProfile(before: ProfileSnapshot, after: ProfileSnapshot): Change[] {
  return (Object.keys(PROFILE_LABELS) as (keyof ProfileSnapshot)[])
    .map((k) => {
      const c = textChange(before[k], after[k]);
      return c ? ({ field: k, label: PROFILE_LABELS[k], ...c } as Change) : null;
    })
    .filter((x): x is Change => x !== null);
}
