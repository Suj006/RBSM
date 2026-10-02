import "server-only";
import type { User } from "@/generated/prisma/client";
import type { BuyerStatus, ItemStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { buyerWhere, itemScope, scopeFor, type BuyerFilters } from "@/lib/buyer-query";
import { ACTION_LABEL, ALL_ITEM_STATUSES, ALL_STATUSES, DIC_VISIBLE_ITEMS, ITEM_META, ROLE_LABEL, STATUS_META } from "@/lib/status";
import { parseCerts } from "@/lib/format";
import { EVENT } from "@/lib/config";
import type { Kpi, Report, Row, Table } from "./types";
import { sellerScope, sellerWhere, type SellerFilters } from "@/lib/seller-query";
import { ALL_SELLER_STATUSES, SELLER_ACTION_LABEL, SELLER_META } from "@/lib/status";
import type { SellerStatus } from "@/generated/prisma/enums";
import { DISTRICT_NAMES, localBodyLabel } from "@/lib/config";
import { fmtMobile } from "@/lib/text";
import { getTargets } from "@/lib/targets";

export const REPORTS = {
  "buyer-register": {
    title: "Buyer Registration Register",
    description: "All registered buyers with contact details, registration stage and sector-wise approval status.",
  },
  "sector-requirements": {
    title: "Sector-wise Requirement Report",
    description: "Each buyer's sourcing requirement by sector — products, specifications, certifications and approval status.",
  },
  "approved-buyers": {
    title: "RBSM Approved Buyer List",
    description: "Buyers approved by the Directorate, with their approved sectors and products.",
  },
  "seller-register": {
    title: "Seller Registration Register",
    description: "Kerala MSME sellers with Udyam number, location, contact details, sectors and products ready to export, and approval status.",
  },
  "seller-district-summary": {
    title: "District-wise Seller Summary",
    description: "Seller registrations and approvals by district, against the targets set by the Directorate.",
  },
  "mis-summary": {
    title: "MIS Summary Report",
    description: "Programme-level summary: registration pipeline, sector approvals, country-wise and sector-wise position.",
  },
} as const;

export type ReportId = keyof typeof REPORTS;
/** Reports a role may open (district offices: seller reports only). */
export const reportsFor = (role: User["role"]): ReportId[] =>
  role === "DISTRICT" ? ["seller-register", "seller-district-summary"]
  : role === "DIC" ? ["sector-requirements", "approved-buyers", "seller-register", "seller-district-summary", "mis-summary"]
  : role === "FIEO" || role === "ADMIN" ? (Object.keys(REPORTS) as ReportId[])
  : [];
export const isReportId = (s: string): s is ReportId => s in REPORTS;

const stamp = (d: Date) => d.toISOString().slice(0, 10);

async function describeFilters(f: BuyerFilters): Promise<string[]> {
  const out: string[] = [];
  if (f.q) out.push(`Search: "${f.q}"`);
  if (f.status === "action") out.push("Buyer status: pending action");
  else if (f.status === "basic_approved") out.push("Buyer status: basic details approved");
  else if (f.status === "basic_pending") out.push("Buyer status: basic details not submitted / returned");
  else if (f.status && ALL_STATUSES.includes(f.status as BuyerStatus)) out.push(`Buyer status: ${STATUS_META[f.status as BuyerStatus].label}`);
  if (f.item && ALL_ITEM_STATUSES.includes(f.item as ItemStatus)) out.push(`Sector status: ${ITEM_META[f.item as ItemStatus].label}`);
  if (f.sector) {
    const s = await prisma.sector.findUnique({ where: { id: f.sector }, select: { name: true } });
    if (s) out.push(`Sector: ${s.name}`);
  }
  if (f.country) out.push(`Country: ${f.country}`);
  return out;
}

function base(id: ReportId, user: User, filters: string[], orientation: Report["orientation"] = "landscape") {
  const generatedAt = new Date();
  return {
    id,
    title: REPORTS[id].title,
    description: REPORTS[id].description,
    generatedAt,
    generatedBy: `${user.displayName} (${ROLE_LABEL[user.role]})`,
    filters,
    orientation,
    fileName: `TRADEX-RBSM-${REPORTS[id].title.replace(/[^A-Za-z0-9]+/g, "-")}-${stamp(generatedAt)}`,
  };
}

const sectorItemFilter = (user: User, f: BuyerFilters) => ({
  ...itemScope(user.role),
  ...(f.sector ? { sectorId: f.sector } : {}),
  ...(f.item && ALL_ITEM_STATUSES.includes(f.item as ItemStatus) ? { status: f.item as ItemStatus } : {}),
});

// ---------------------------------------------------------------- buyer register

async function buyerRegister(user: User, f: BuyerFilters): Promise<Report> {
  const buyers = await prisma.buyer.findMany({
    where: buyerWhere(user.role, f),
    orderBy: { seq: "asc" },
    include: {
      user: { select: { username: true } },
      requirement: { include: { items: { where: itemScope(user.role), orderBy: { sortOrder: "asc" }, include: { sector: true } } } },
    },
  });
  const rows: Row[] = buyers.map((b, i) => {
    const items = b.requirement?.items ?? [];
    return {
      sl: i + 1, regNo: b.regNo, approvedNo: b.approvedNo, username: b.user.username, name: b.name, country: b.country,
      pocName: b.pocName, pocDesignation: b.pocDesignation, email: b.pocEmail ?? b.signupEmail, mobile: b.pocMobile,
      status: b.status,
      sectors: items.map((it) => `${it.sector.name} (${ITEM_META[it.status].short})`).join("\n"),
      approvedSectors: items.filter((it) => it.status === "APPROVED").length,
      totalSectors: items.length,
      createdAt: b.createdAt, basicApprovedAt: b.basicApprovedAt, approvedAt: b.approvedAt,
    };
  });
  const n = (s: BuyerStatus[]) => buyers.filter((b) => s.includes(b.status)).length;
  const kpis: Kpi[] = [
    { label: "Buyers", value: buyers.length, tone: "blue" },
    { label: "Approved buyers", value: n(["APPROVED"]), tone: "green" },
    { label: "Requirement stage", value: n(["BASIC_APPROVED"]), tone: "violet" },
    { label: "Basic details pending / under review", value: n(["SIGNED_UP", "BASIC_SUBMITTED", "BASIC_RETURNED"]), tone: "yellow" },
  ];
  return {
    ...base("buyer-register", user, await describeFilters(f)),
    kpis,
    tables: [{
      name: "Buyer Register",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "regNo", header: "Reg. No.", width: 14, kind: "mono" },
        { key: "approvedNo", header: "Buyer No.", width: 18, kind: "mono" },
        { key: "name", header: "Buyer Name", width: 26 },
        { key: "country", header: "Country", width: 16 },
        { key: "pocName", header: "Contact Person", width: 20 },
        { key: "pocDesignation", header: "Designation", width: 18 },
        { key: "email", header: "E-mail", width: 28 },
        { key: "mobile", header: "Mobile", width: 17 },
        { key: "status", header: "Registration Status", width: 20, kind: "buyerStatus" },
        { key: "sectors", header: "Sectors (Status)", width: 34 },
        { key: "approvedSectors", header: "Approved Sectors", width: 13, kind: "number", align: "center" },
        { key: "createdAt", header: "Registered On", width: 15, kind: "date" },
        { key: "approvedAt", header: "Approved On", width: 15, kind: "date" },
      ],
      rows,
    }],
  };
}

// ---------------------------------------------------------------- sector-wise requirements

async function sectorRequirements(user: User, f: BuyerFilters): Promise<Report> {
  const items = await prisma.requirementItem.findMany({
    where: { ...sectorItemFilter(user, f), requirement: { buyer: buyerWhere(user.role, f) } },
    orderBy: [{ sector: { sortOrder: "asc" } }, { sector: { name: "asc" } }, { requirement: { buyer: { seq: "asc" } } }],
    include: { sector: true, requirement: { include: { buyer: true } } },
  });
  const rows: Row[] = items.map((it, i) => {
    const b = it.requirement.buyer;
    return {
      sl: i + 1, sector: it.sector.name, buyer: b.name, regNo: b.regNo, approvedNo: b.approvedNo, country: b.country,
      products: it.products, specifications: it.specifications, certifications: parseCerts(it.certifications).join(", "),
      quantity: it.quantity, orgType: it.requirement.organisationType, value: it.requirement.annualSourcingValue,
      status: it.status, submittedAt: it.submittedAt, approvedAt: it.approvedAt,
    };
  });
  const n = (s: ItemStatus[]) => items.filter((it) => s.includes(it.status)).length;
  return {
    ...base("sector-requirements", user, await describeFilters(f)),
    kpis: [
      { label: "Sector requirements", value: items.length, tone: "blue" },
      { label: "Approved", value: n(["APPROVED"]), tone: "green" },
      { label: "Under review", value: n(["SUBMITTED", "FIEO_RECOMMENDED", "DIC_RETURNED"]), tone: "yellow" },
      { label: "Returned / draft", value: n(["FIEO_RETURNED", "DRAFT"]), tone: "red" },
    ],
    tables: [{
      name: "Sector Requirements",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "sector", header: "Sector", width: 22 },
        { key: "buyer", header: "Buyer Name", width: 24 },
        { key: "regNo", header: "Reg. No.", width: 14, kind: "mono" },
        { key: "country", header: "Country", width: 15 },
        { key: "products", header: "Products", width: 30 },
        { key: "specifications", header: "Specifications", width: 30 },
        { key: "certifications", header: "Certifications Required", width: 26 },
        { key: "quantity", header: "Indicative Volume", width: 16 },
        { key: "value", header: "Annual Sourcing Value", width: 18 },
        { key: "status", header: "Status", width: 22, kind: "itemStatus" },
        { key: "approvedAt", header: "Approved On", width: 15, kind: "date" },
      ],
      rows,
    }],
  };
}

// ---------------------------------------------------------------- approved buyers

async function approvedBuyers(user: User, f: BuyerFilters): Promise<Report> {
  const buyers = await prisma.buyer.findMany({
    where: { AND: [buyerWhere(user.role, f), { status: "APPROVED" }] },
    orderBy: { approvedSeq: "asc" },
    include: { requirement: { include: { items: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" }, include: { sector: true } } } } },
  });
  const sectors = new Set(buyers.flatMap((b) => b.requirement?.items.map((i) => i.sectorId) ?? []));
  return {
    ...base("approved-buyers", user, await describeFilters({ ...f, status: undefined })),
    kpis: [
      { label: "Approved buyers", value: buyers.length, tone: "green" },
      { label: "Approved sector requirements", value: buyers.reduce((n, b) => n + (b.requirement?.items.length ?? 0), 0), tone: "blue" },
      { label: "Sectors covered", value: sectors.size, tone: "violet" },
      { label: "Countries", value: new Set(buyers.map((b) => b.country)).size, tone: "yellow" },
    ],
    tables: [{
      name: "Approved Buyers",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "approvedNo", header: "Buyer No.", width: 19, kind: "mono" },
        { key: "name", header: "Buyer Name", width: 28 },
        { key: "country", header: "Country", width: 16 },
        { key: "pocName", header: "Contact Person", width: 20 },
        { key: "pocDesignation", header: "Designation", width: 18 },
        { key: "email", header: "E-mail", width: 28 },
        { key: "mobile", header: "Mobile", width: 17 },
        { key: "sectors", header: "Approved Sectors", width: 28 },
        { key: "products", header: "Products", width: 36 },
        { key: "approvedAt", header: "Approved On", width: 15, kind: "date" },
      ],
      rows: buyers.map((b, i) => ({
        sl: i + 1, approvedNo: b.approvedNo, name: b.name, country: b.country, pocName: b.pocName, pocDesignation: b.pocDesignation,
        email: b.pocEmail ?? b.signupEmail, mobile: b.pocMobile,
        sectors: b.requirement?.items.map((it) => it.sector.name).join("\n"),
        products: b.requirement?.items.map((it) => `${it.sector.name}: ${it.products}`).join("\n"),
        approvedAt: b.approvedAt,
      })),
    }],
  };
}

// ---------------------------------------------------------------- MIS summary

async function misSummary(user: User): Promise<Report> {
  const scope = scopeFor(user.role);
  const iScope = itemScope(user.role);
  const [buyers, items] = await Promise.all([
    prisma.buyer.findMany({ where: scope, select: { id: true, status: true, country: true } }),
    prisma.requirementItem.findMany({
      where: iScope,
      select: { status: true, sector: { select: { name: true, sortOrder: true } }, requirement: { select: { buyer: { select: { country: true } } } } },
    }),
  ]);
  const pct = (n: number, d: number) => (d ? n / d : null);

  const buyerStatuses = user.role === "DIC" ? (["BASIC_APPROVED", "APPROVED"] as BuyerStatus[]) : ALL_STATUSES;
  const buyerTable: Table = {
    name: "Registration Pipeline",
    heading: "1. Buyer registration pipeline",
    columns: [
      { key: "label", header: "Registration Stage", width: 34 },
      { key: "count", header: "Buyers", width: 12, kind: "number", align: "right" },
      { key: "share", header: "Share", width: 12, kind: "percent", align: "right" },
    ],
    rows: buyerStatuses.map((s) => {
      const c = buyers.filter((b) => b.status === s).length;
      return { label: STATUS_META[s].label, count: c, share: pct(c, buyers.length) };
    }),
    totals: { label: "Total", count: buyers.length, share: buyers.length ? 1 : null },
  };

  const itemStatuses = user.role === "DIC" ? DIC_VISIBLE_ITEMS : ALL_ITEM_STATUSES;
  const itemTable: Table = {
    name: "Sector Approvals",
    heading: "2. Sector requirement approvals",
    columns: [
      { key: "label", header: "Sector Requirement Status", width: 34 },
      { key: "count", header: "Requirements", width: 14, kind: "number", align: "right" },
      { key: "share", header: "Share", width: 12, kind: "percent", align: "right" },
    ],
    rows: itemStatuses.map((s) => {
      const c = items.filter((i) => i.status === s).length;
      return { label: ITEM_META[s].label, count: c, share: pct(c, items.length) };
    }),
    totals: { label: "Total", count: items.length, share: items.length ? 1 : null },
  };

  const countries = [...new Set(buyers.map((b) => b.country))].sort();
  const countryRows = countries
    .map((c) => {
      const bs = buyers.filter((b) => b.country === c);
      const its = items.filter((i) => i.requirement.buyer.country === c);
      return {
        country: c, buyers: bs.length, approved: bs.filter((b) => b.status === "APPROVED").length,
        sectors: its.length, approvedSectors: its.filter((i) => i.status === "APPROVED").length,
      };
    })
    .sort((a, b) => b.buyers - a.buyers || a.country.localeCompare(b.country));
  const sum = (rows: Record<string, unknown>[], k: string) => rows.reduce((n, r) => n + Number(r[k] ?? 0), 0);
  const countryTable: Table = {
    name: "Country-wise",
    heading: "3. Country-wise position",
    columns: [
      { key: "country", header: "Country", width: 28 },
      { key: "buyers", header: "Buyers", width: 11, kind: "number", align: "right" },
      { key: "approved", header: "Approved Buyers", width: 14, kind: "number", align: "right" },
      { key: "sectors", header: "Sector Requirements", width: 16, kind: "number", align: "right" },
      { key: "approvedSectors", header: "Approved Sectors", width: 14, kind: "number", align: "right" },
    ],
    rows: countryRows,
    totals: { country: "Total", buyers: sum(countryRows, "buyers"), approved: sum(countryRows, "approved"), sectors: sum(countryRows, "sectors"), approvedSectors: sum(countryRows, "approvedSectors") },
  };

  const sectorNames = [...new Map(items.map((i) => [i.sector.name, i.sector.sortOrder])).entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const sectorRows = sectorNames.map(([name]) => {
    const its = items.filter((i) => i.sector.name === name);
    return {
      sector: name, total: its.length,
      approved: its.filter((i) => i.status === "APPROVED").length,
      review: its.filter((i) => i.status === "SUBMITTED" || i.status === "FIEO_RECOMMENDED" || i.status === "DIC_RETURNED").length,
      returned: its.filter((i) => i.status === "FIEO_RETURNED" || i.status === "DRAFT").length,
    };
  });
  const sectorTable: Table = {
    name: "Sector-wise",
    heading: "4. Sector-wise position",
    columns: [
      { key: "sector", header: "Sector", width: 32 },
      { key: "total", header: "Buyers Interested", width: 14, kind: "number", align: "right" },
      { key: "approved", header: "Approved", width: 11, kind: "number", align: "right" },
      { key: "review", header: "Under Review", width: 12, kind: "number", align: "right" },
      { key: "returned", header: user.role === "DIC" ? "Returned" : "Returned / Draft", width: 14, kind: "number", align: "right" },
    ],
    rows: sectorRows,
    totals: { sector: "Total", total: sum(sectorRows, "total"), approved: sum(sectorRows, "approved"), review: sum(sectorRows, "review"), returned: sum(sectorRows, "returned") },
  };

  return {
    ...base("mis-summary", user, user.role === "DIC" ? ["Scope: buyers with sectors recommended to the Directorate"] : [], "portrait"),
    kpis: [
      { label: "Registered buyers", value: buyers.length, tone: "blue" },
      { label: "Approved buyers", value: buyers.filter((b) => b.status === "APPROVED").length, tone: "green" },
      { label: "Sector requirements", value: items.length, tone: "violet" },
      { label: "Approved sectors", value: items.filter((i) => i.status === "APPROVED").length, tone: "green" },
      { label: "Countries", value: countries.length, tone: "yellow" },
    ],
    tables: [buyerTable, itemTable, countryTable, sectorTable],
  };
}

export async function buildReport(id: ReportId, user: User, f: BuyerFilters & SellerFilters): Promise<Report> {
  switch (id) {
    case "seller-register": return sellerRegister(user, f);
    case "seller-district-summary": return sellerDistrictSummary(user);
    case "buyer-register": return buyerRegister(user, f);
    case "sector-requirements": return sectorRequirements(user, f);
    case "approved-buyers": return approvedBuyers(user, f);
    case "mis-summary": return misSummary(user);
  }
}

// ---------------------------------------------------------------- single buyer profile (dossier)

export async function buildDossier(user: User, buyerId: string): Promise<Report | null> {
  const b = await prisma.buyer.findFirst({
    where: { AND: [{ id: buyerId }, scopeFor(user.role)] },
    include: {
      user: { select: { username: true } },
      documents: true,
      requirement: { include: { items: { where: itemScope(user.role), orderBy: { sortOrder: "asc" }, include: { sector: true } } } },
      reviewLogs: { orderBy: { createdAt: "asc" }, include: { actor: { select: { displayName: true } } } },
    },
  });
  if (!b) return null;
  const r = b.requirement;
  const kv = (rows: [string, Row[string]][]): Row[] => rows.map(([label, value]) => ({ label, value }));
  const kvCols = [
    { key: "label", header: "Particulars", width: 28 },
    { key: "value", header: "Details", width: 62 },
  ];
  const doc = (k: "PROFILE" | "CREDENTIALS") => b.documents.find((d) => d.kind === k)?.originalName ?? "Not uploaded";
  const generatedAt = new Date();
  return {
    id: "buyer-profile",
    title: "Buyer Profile",
    description: `${b.name} — ${b.regNo}${b.approvedNo ? ` / ${b.approvedNo}` : ""}`,
    generatedAt,
    generatedBy: `${user.displayName} (${ROLE_LABEL[user.role]})`,
    filters: [],
    orientation: "portrait",
    fileName: `TRADEX-RBSM-Buyer-Profile-${b.regNo}-${stamp(generatedAt)}`,
    kpis: [
      { label: "Registration status", value: STATUS_META[b.status].label, tone: b.status === "APPROVED" ? "green" : "blue" },
      { label: "Sector requirements", value: r?.items.length ?? 0, tone: "violet" },
      { label: "Approved sectors", value: r?.items.filter((i) => i.status === "APPROVED").length ?? 0, tone: "green" },
    ],
    tables: [
      {
        name: "Basic Details", heading: "1. Basic details", columns: kvCols,
        rows: kv([
          ["Registration No.", b.regNo], ["Buyer No.", b.approvedNo ?? "Not yet approved"], ["Login ID", b.user.username],
          ["Name of the buyer", b.name], ["Country", b.country], ["Sign-up e-mail", b.signupEmail],
          ["Contact person", b.pocName], ["Designation", b.pocDesignation], ["Contact e-mail", b.pocEmail], ["Mobile number", b.pocMobile],
          ["Company profile", doc("PROFILE")], ["Organisation credentials", doc("CREDENTIALS")],
          ["Registered on", b.createdAt], ["Basic details approved on", b.basicApprovedAt], ["Approved as RBSM buyer on", b.approvedAt],
        ]),
      },
      {
        name: "Sourcing Profile", heading: "2. Sourcing profile", columns: kvCols,
        rows: kv([
          ["Organisation type", r?.organisationType], ["Annual sourcing value", r?.annualSourcingValue], ["Sourcing timeline", r?.sourcingTimeline],
          ["Preferred engagement", r?.preferredEngagement], ["Procurement interests", r?.procurementInterests],
        ]),
      },
      {
        name: "Sector Requirements", heading: "3. Sector requirements",
        columns: [
          { key: "sl", header: "Sl.", width: 4, kind: "number", align: "center" },
          { key: "sector", header: "Sector", width: 18 },
          { key: "products", header: "Products & Specifications", width: 34 },
          { key: "certifications", header: "Certifications", width: 18 },
          { key: "status", header: "Status", width: 16, kind: "itemStatus" },
        ],
        rows: (r?.items ?? []).map((it, i) => ({
          sl: i + 1, sector: it.sector.name,
          products: [it.products, it.specifications && `Spec: ${it.specifications}`, it.quantity && `Volume: ${it.quantity}`].filter(Boolean).join("\n"),
          certifications: parseCerts(it.certifications).join(", "), status: it.status,
        })),
      },
      {
        name: "Activity Log", heading: "4. Activity log",
        columns: [
          { key: "at", header: "Date & Time", width: 17, kind: "datetime" },
          { key: "by", header: "By", width: 16 },
          { key: "action", header: "Action", width: 30 },
          { key: "comment", header: "Comment", width: 30 },
        ],
        rows: b.reviewLogs.map((l) => ({
            at: l.createdAt,
            by: l.actorRole === "BUYER" ? "Buyer" : `${ROLE_LABEL[l.actorRole]}${l.actor ? ` — ${l.actor.displayName}` : ""}`,
            action: `${ACTION_LABEL[l.action]}${l.sectorName ? ` (${l.sectorName})` : ""}`,
          comment: l.comment,
        })),
      },
    ],
  };
}

export const EVENT_LINE = `${EVENT.name} · ${EVENT.programme}`;

// ---------------------------------------------------------------- sellers

async function describeSellerFilters(user: User, f: SellerFilters): Promise<string[]> {
  const out: string[] = [];
  if (user.role === "DISTRICT") out.push(`District: ${user.district}`);
  if (user.role === "FIEO") out.push("Approved sellers only");
  if (f.q) out.push(`Search: "${f.q}"`);
  if (f.status === "action") out.push("Status: needs action");
  else if (f.status && ALL_SELLER_STATUSES.includes(f.status as SellerStatus)) out.push(`Status: ${SELLER_META[f.status as SellerStatus].label}`);
  if (f.sector) {
    const sec = await prisma.sector.findUnique({ where: { id: f.sector }, select: { name: true } });
    if (sec) out.push(`Sector: ${sec.name}`);
  }
  if (f.district) out.push(`District: ${f.district}`);
  if (f.exp === "yes") out.push("Export experience: Yes");
  if (f.exp === "no") out.push("Export experience: No");
  return out;
}

async function sellerRegister(user: User, f: SellerFilters): Promise<Report> {
  const sellers = await prisma.seller.findMany({
    where: sellerWhere(user, f),
    orderBy: [{ district: "asc" }, { seq: "asc" }],
    include: { products: { orderBy: { sortOrder: "asc" }, include: { sector: true } } },
  });
  const n = (s: SellerStatus[]) => sellers.filter((x) => s.includes(x.status)).length;
  return {
    ...base("seller-register", user, await describeSellerFilters(user, f)),
    kpis: [
      { label: "Sellers", value: sellers.length, tone: "blue" },
      { label: "Approved", value: n(["APPROVED"]), tone: "green" },
      { label: "Awaiting approval", value: n(["WITH_DISTRICT", "RECOMMENDED", "RETURNED"]), tone: "yellow" },
      { label: "With export experience", value: sellers.filter((x) => x.exportExperience).length, tone: "violet" },
    ],
    tables: [{
      name: "Seller Register",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "regNo", header: "Reg. No.", width: 13, kind: "mono" },
        { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono" },
        { key: "name", header: "Name of Seller", width: 26 },
        { key: "district", header: "District", width: 16 },
        { key: "taluk", header: "Taluk", width: 17 },
        { key: "localBody", header: "Local Body", width: 20 },
        { key: "udyamNo", header: "Udyam Number", width: 21, kind: "mono" },
        { key: "exp", header: "Export Exp.", width: 9, align: "center" },
        { key: "contact", header: "Contact Person", width: 18 },
        { key: "mobile", header: "Mobile / WhatsApp", width: 17 },
        { key: "email", header: "E-mail", width: 26 },
        { key: "products", header: "Sectors & Products", width: 37 },
        { key: "status", header: "Status", width: 20, kind: "sellerStatus" },
      ],
      rows: sellers.map((x, i) => ({
        sl: i + 1, regNo: x.regNo, approvedNo: x.approvedNo, name: x.name, district: x.district, taluk: x.taluk,
        localBody: `${x.localBodyName} ${localBodyLabel(x.localBodyType)}`, udyamNo: x.udyamNo, exp: x.exportExperience ? "Yes" : "No",
        contact: x.contactName,
        mobile: fmtMobile(x.contactMobile) + (x.contactWhatsapp !== x.contactMobile ? `\nWA: ${fmtMobile(x.contactWhatsapp)}` : ""),
        email: x.contactEmail,
        products: x.products.map((p) => `${p.sector.name}: ${p.products}`).join("\n"),
        status: x.status,
      })),
    }],
  };
}

async function sellerDistrictSummary(user: User): Promise<Report> {
  const sellers = await prisma.seller.findMany({ where: sellerScope(user), select: { district: true, status: true, exportExperience: true } });
  const districts = user.role === "DISTRICT" ? [user.district ?? ""] : DISTRICT_NAMES;
  const targets = await getTargets();
  const rows = districts.map((d) => {
    const ds = sellers.filter((x) => x.district === d);
    const c = (...st: SellerStatus[]) => ds.filter((x) => st.includes(x.status)).length;
    const approved = c("APPROVED");
    return {
      district: d, total: ds.length, pending: c("WITH_DISTRICT", "RETURNED"), recommended: c("RECOMMENDED"),
      approved, rejected: c("REJECTED"), exp: ds.filter((x) => x.exportExperience).length, target: targets.district[d] ?? 0,
      achieved: targets.district[d] ? approved / targets.district[d] : null,
    };
  });
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const totalApproved = sum("approved");
  const fieo = user.role === "FIEO";
  return {
    ...base("seller-district-summary", user,
      user.role === "DISTRICT" ? [`District: ${user.district}`]
      : fieo ? ["Approved sellers only"]
      : user.role === "DIC" ? ["Sellers recommended to the Directorate (with Directorate, returned or approved)"] : [], "portrait"),
    kpis: [
      { label: "Sellers", value: sellers.length, tone: "blue" },
      { label: "Approved sellers", value: totalApproved, tone: "green" },
      ...(fieo ? [] : [{ label: `Target (${user.role === "DISTRICT" ? "district" : "programme"})`, value: user.role === "DISTRICT" ? targets.district[user.district ?? ""] ?? 0 : targets.sellers, tone: "yellow" as const }]),
    ],
    tables: [{
      name: "District-wise",
      columns: [
        { key: "district", header: "District", width: 22 },
        ...(fieo ? [] : [
          { key: "total", header: "Registered", width: 11, kind: "number" as const, align: "right" as const },
          { key: "pending", header: "With District", width: 11, kind: "number" as const, align: "right" as const },
          { key: "recommended", header: "With Directorate", width: 13, kind: "number" as const, align: "right" as const },
        ]),
        { key: "approved", header: "Approved", width: 11, kind: "number", align: "right" },
        ...(fieo ? [] : [{ key: "rejected", header: "Rejected", width: 10, kind: "number" as const, align: "right" as const }]),
        { key: "exp", header: "Export Exp.", width: 11, kind: "number", align: "right" },
        // Targets are an internal Directorate / district matter — not shown to FIEO.
        ...(fieo ? [] : [
          { key: "target", header: "Target", width: 9, kind: "number" as const, align: "right" as const },
          { key: "achieved", header: "Achieved", width: 10, kind: "percent" as const, align: "right" as const },
        ]),
      ],
      rows,
      totals: {
        district: "Total", total: sum("total"), pending: sum("pending"), recommended: sum("recommended"), approved: totalApproved,
        rejected: sum("rejected"), exp: sum("exp"),
        target: user.role === "DISTRICT" ? targets.district[user.district ?? ""] ?? 0 : targets.sellers,
        achieved: (user.role === "DISTRICT" ? targets.district[user.district ?? ""] : targets.sellers) ? totalApproved / (user.role === "DISTRICT" ? targets.district[user.district ?? ""] : targets.sellers) : null,
      },
    }],
  };
}

export async function buildSellerProfile(user: User, sellerId: string): Promise<Report | null> {
  const x = await prisma.seller.findFirst({
    where: { AND: [{ id: sellerId }, sellerScope(user)] },
    include: {
      products: { orderBy: { sortOrder: "asc" }, include: { sector: true } },
      logs: { orderBy: { createdAt: "asc" }, include: { actor: { select: { displayName: true } } } },
      user: { select: { username: true } },
    },
  });
  if (!x) return null;
  const generatedAt = new Date();
  const kvCols = [{ key: "label", header: "Particulars", width: 28 }, { key: "value", header: "Details", width: 62 }];
  const kv = (rows: [string, Row[string]][]): Row[] => rows.map(([label, value]) => ({ label, value }));
  return {
    id: "seller-profile",
    title: "Seller Profile",
    description: `${x.name} — ${x.regNo}${x.approvedNo ? ` / ${x.approvedNo}` : ""}`,
    generatedAt,
    generatedBy: `${user.displayName} (${ROLE_LABEL[user.role]})`,
    filters: [],
    orientation: "portrait",
    fileName: `TRADEX-RBSM-Seller-Profile-${x.regNo}-${stamp(generatedAt)}`,
    kpis: [
      { label: "Status", value: SELLER_META[x.status].label, tone: x.status === "APPROVED" ? "green" : "blue" },
      { label: "Sectors", value: x.products.length, tone: "violet" },
      { label: "Export experience", value: x.exportExperience ? "Yes" : "No", tone: "yellow" },
    ],
    tables: [
      {
        name: "Seller Details", heading: "1. Enterprise and contact details", columns: kvCols,
        rows: kv([
          ["Registration No.", x.regNo], ["Seller No.", x.approvedNo ?? "Not yet approved"], ["Login ID", x.user?.username ?? "Allotted on approval"],
          ["Name of the seller", x.name], ["Udyam number", x.udyamNo], ["District", x.district], ["Taluk", x.taluk],
          ["Local body", `${x.localBodyName} ${localBodyLabel(x.localBodyType)}`], ["Export experience", x.exportExperience ? "Yes" : "No"],
          ["Contact person", x.contactName], ["Mobile number", fmtMobile(x.contactMobile)], ["WhatsApp number", fmtMobile(x.contactWhatsapp)],
          ["E-mail ID", x.contactEmail],
          ["Source", x.source === "SELF" ? "Self-registered" : x.source === "BULK" ? "Bulk upload by DIC" : "Entered by DIC"],
          ["Registered on", x.createdAt], ["Recommended on", x.recommendedAt], ["Approved on", x.approvedAt],
        ]),
      },
      {
        name: "Products", heading: "2. Sectors and products ready to export",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "sector", header: "Sector", width: 30 },
          { key: "products", header: "Products", width: 60 },
        ],
        rows: x.products.map((p, i) => ({ sl: i + 1, sector: p.sector.name, products: p.products })),
      },
      {
        name: "Activity Log", heading: "3. Activity log",
        columns: [
          { key: "at", header: "Date & Time", width: 18, kind: "datetime" },
          { key: "by", header: "By", width: 22 },
          { key: "action", header: "Action", width: 24 },
          { key: "comment", header: "Comment", width: 30 },
        ],
        rows: x.logs.map((l) => ({
          at: l.createdAt,
          by: l.actorRole ? `${ROLE_LABEL[l.actorRole]}${l.actor ? ` — ${l.actor.displayName}` : ""}` : "Seller",
          action: SELLER_ACTION_LABEL[l.action], comment: l.comment,
        })),
      },
    ],
  };
}
