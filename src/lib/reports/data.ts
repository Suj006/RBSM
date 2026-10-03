import "server-only";
import type { User } from "@/generated/prisma/client";
import type { BuyerStatus, ItemStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { buyerWhere, itemScope, scopeFor, type BuyerFilters } from "@/lib/buyer-query";
import { ACTION_LABEL, ALL_ITEM_STATUSES, ALL_STATUSES, ITEM_META, ROLE_LABEL, STATUS_META } from "@/lib/status";
import { parseCerts } from "@/lib/format";
import { EVENT } from "@/lib/config";
import type { Kpi, Report, Row, Table } from "./types";
import { sellerScope, sellerWhere, type SellerFilters } from "@/lib/seller-query";
import { ALL_SELLER_STATUSES, SELLER_ACTION_LABEL, SELLER_META } from "@/lib/status";
import type { SellerStatus } from "@/generated/prisma/enums";
import { DISTRICT_NAMES, localBodyLabel } from "@/lib/config";
import { fmtMobile } from "@/lib/text";
import { getTargets } from "@/lib/targets";
import { productDemand, sectorDemandSummary } from "@/lib/demand";
import { AGE_BUCKETS, buildInsights } from "@/lib/insights";

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
    description: "Complete details of buyers approved by the Directorate: contact, sourcing profile, and every approved sector with products, specifications, certifications and volumes.",
  },
  "approved-sellers": {
    title: "RBSM Approved Seller List",
    description: "Complete details of sellers approved by the Directorate: Udyam number, location, promoter contact, export experience, and every sector with the products ready to export.",
  },
  "seller-register": {
    title: "Seller Registration Register",
    description: "Kerala MSME sellers with Udyam number, location, contact details, sectors and products ready to export, and approval status.",
  },
  "seller-district-summary": {
    title: "District-wise Seller Summary",
    description: "Seller registrations and approvals by district, against the targets set by the Directorate.",
  },
  "sector-demand": {
    title: "Sector Demand Report",
    description: "Sector by sector: buyers, products requested (with the buyers asking for each), certifications, and approved sellers offering the sector.",
  },
  "product-demand": {
    title: "Product Demand Report",
    description: "Every product buyers have requested, by sector: buyers asking for it (approved / pending), their countries, and the approved sellers offering it — supply gaps highlighted.",
  },
  "insights": {
    title: "Directorate Insights",
    description: "Matchmaking readiness of approved buyers, supply gaps, district × sector supply, markets × sectors demand, certifications required, turnaround and ageing.",
  },
  "mis-summary": {
    title: "MIS Summary Report",
    description: "Programme-level summary: registration pipeline, sector approvals, country-wise and sector-wise position.",
  },
} as const;

export type ReportId = keyof typeof REPORTS;
/** Reports a role may open (district offices: seller reports only). */
export const reportsFor = (role: User["role"]): ReportId[] =>
  role === "DISTRICT" ? ["approved-sellers", "seller-register", "seller-district-summary"]
  : role === "FIEO" ? (Object.keys(REPORTS) as ReportId[]).filter((id) => id !== "insights")
  : role === "DIC" || role === "ADMIN" ? (Object.keys(REPORTS) as ReportId[])
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
      sectors: items.map((it) => `${it.sector.name} (${ITEM_META[it.status].short}): ${it.products}`).join("\n"),
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
        { key: "sectors", header: "Sectors (Status): Products", width: 46 },
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
    tables: [
      {
        name: "Approved Buyers",
        heading: "1. Approved buyers",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Buyer No.", width: 19, kind: "mono" },
          { key: "regNo", header: "Reg. No.", width: 13, kind: "mono", excelOnly: true },
          { key: "name", header: "Buyer Name", width: 26 },
          { key: "country", header: "Country", width: 15 },
          { key: "pocName", header: "Contact Person", width: 20 },
          { key: "pocDesignation", header: "Designation", width: 18 },
          { key: "email", header: "E-mail", width: 28 },
          { key: "mobile", header: "Mobile", width: 17 },
          { key: "orgType", header: "Organisation Type", width: 18 },
          { key: "value", header: "Annual Sourcing Value", width: 18 },
          { key: "timeline", header: "Sourcing Timeline", width: 18, excelOnly: true },
          { key: "engagement", header: "Preferred Engagement", width: 18, excelOnly: true },
          { key: "sectors", header: "Approved Sectors & Products", width: 44 },
          { key: "approvedAt", header: "Approved On", width: 14, kind: "date" },
        ],
        rows: buyers.map((b, i) => ({
          sl: i + 1, approvedNo: b.approvedNo, regNo: b.regNo, name: b.name, country: b.country, pocName: b.pocName, pocDesignation: b.pocDesignation,
          email: b.pocEmail ?? b.signupEmail, mobile: b.pocMobile,
          orgType: b.requirement?.organisationType, value: b.requirement?.annualSourcingValue, timeline: b.requirement?.sourcingTimeline,
          engagement: b.requirement?.preferredEngagement,
          sectors: b.requirement?.items.map((it) => `${it.sector.name}: ${it.products}`).join("\n"),
          approvedAt: b.approvedAt,
        })),
      },
      {
        name: "Approved Sector Requirements",
        heading: "2. Approved sector requirements",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Buyer No.", width: 19, kind: "mono" },
          { key: "name", header: "Buyer Name", width: 24 },
          { key: "country", header: "Country", width: 14 },
          { key: "sector", header: "Sector", width: 22 },
          { key: "products", header: "Products", width: 30 },
          { key: "specifications", header: "Specifications", width: 30 },
          { key: "certifications", header: "Certifications Required", width: 26 },
          { key: "quantity", header: "Indicative Volume", width: 18 },
          { key: "approvedAt", header: "Approved On", width: 14, kind: "date" },
        ],
        rows: buyers.flatMap((b) => (b.requirement?.items ?? []).map((it) => ({ b, it }))).map(({ b, it }, i) => ({
          sl: i + 1, approvedNo: b.approvedNo, name: b.name, country: b.country, sector: it.sector.name, products: it.products,
          specifications: it.specifications, certifications: parseCerts(it.certifications).join(", "), quantity: it.quantity, approvedAt: it.approvedAt,
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------- approved sellers (complete details)

async function approvedSellers(user: User, f: SellerFilters): Promise<Report> {
  const sellers = await prisma.seller.findMany({
    where: { AND: [sellerWhere(user, { ...f, status: undefined }), { status: "APPROVED" }] },
    orderBy: { approvedSeq: "asc" },
    include: { products: { orderBy: { sortOrder: "asc" }, include: { sector: true } } },
  });
  const filters = (await describeSellerFilters(user, { ...f, status: undefined })).filter((x) => x !== "Approved sellers only");
  return {
    ...base("approved-sellers", user, filters),
    kpis: [
      { label: "Approved sellers", value: sellers.length, tone: "green" },
      { label: "With export experience", value: sellers.filter((x) => x.exportExperience).length, tone: "blue" },
      { label: "Sectors covered", value: new Set(sellers.flatMap((x) => x.products.map((p) => p.sectorId))).size, tone: "violet" },
      { label: "Districts", value: new Set(sellers.map((x) => x.district)).size, tone: "yellow" },
    ],
    tables: [
      {
        name: "Approved Sellers",
        heading: "1. Approved sellers",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono" },
          { key: "regNo", header: "Reg. No.", width: 13, kind: "mono", excelOnly: true },
          { key: "name", header: "Name of Seller", width: 26 },
          { key: "district", header: "District", width: 16 },
          { key: "taluk", header: "Taluk", width: 16, excelOnly: true },
          { key: "localBody", header: "Local Body", width: 20 },
          { key: "udyamNo", header: "Udyam Number", width: 21, kind: "mono" },
          { key: "exp", header: "Export Exp.", width: 9, align: "center" },
          { key: "contact", header: "Promoter / Contact", width: 18 },
          { key: "mobile", header: "Mobile", width: 15 },
          { key: "whatsapp", header: "WhatsApp", width: 15, excelOnly: true },
          { key: "email", header: "E-mail", width: 26 },
          { key: "sectors", header: "Sectors & Products Ready to Export", width: 44 },
          { key: "approvedAt", header: "Approved On", width: 14, kind: "date" },
        ],
        rows: sellers.map((x, i) => ({
          sl: i + 1, approvedNo: x.approvedNo, regNo: x.regNo, name: x.name, district: x.district, taluk: x.taluk,
          localBody: `${x.localBodyName} ${localBodyLabel(x.localBodyType)}`, udyamNo: x.udyamNo, exp: x.exportExperience ? "Yes" : "No",
          contact: x.contactName, mobile: fmtMobile(x.contactMobile), whatsapp: fmtMobile(x.contactWhatsapp), email: x.contactEmail,
          sectors: x.products.map((p) => `${p.sector.name}: ${p.products}`).join("\n"), approvedAt: x.approvedAt,
        })),
      },
      {
        name: "Sectors & Products",
        heading: "2. Sectors and products ready to export",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono" },
          { key: "name", header: "Name of Seller", width: 26 },
          { key: "district", header: "District", width: 16 },
          { key: "sector", header: "Sector", width: 24 },
          { key: "products", header: "Products Ready to Export", width: 44 },
          { key: "exp", header: "Export Exp.", width: 9, align: "center" },
        ],
        rows: sellers.flatMap((x) => x.products.map((p) => ({ x, p }))).map(({ x, p }, i) => ({
          sl: i + 1, approvedNo: x.approvedNo, name: x.name, district: x.district, sector: p.sector.name, products: p.products,
          exp: x.exportExperience ? "Yes" : "No",
        })),
      },
    ],
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

  const itemStatuses = ALL_ITEM_STATUSES;
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
    ...base("mis-summary", user, [], "portrait"),
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
    case "sector-demand": return sectorDemandReport(user, f);
    case "seller-district-summary": return sellerDistrictSummary(user);
    case "buyer-register": return buyerRegister(user, f);
    case "sector-requirements": return sectorRequirements(user, f);
    case "approved-buyers": return approvedBuyers(user, f);
    case "approved-sellers": return approvedSellers(user, f);
    case "mis-summary": return misSummary(user);
    case "product-demand": return productDemandReport(user, f as BuyerFilters & { view?: string });
    case "insights": return insightsReport(user);
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
          ["Preferred engagement", r?.preferredEngagement],
          ...(r?.procurementInterests ? [["Procurement interests", r.procurementInterests] as [string, string]] : []),
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
      { label: "Awaiting approval", value: n(["WITH_DISTRICT", "WITH_SELLER", "RECOMMENDED", "RETURNED"]), tone: "yellow" },
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
      district: d, total: ds.length, pending: c("WITH_DISTRICT", "WITH_SELLER", "RETURNED"), recommended: c("RECOMMENDED"),
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
      : [], "portrait"),
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
          { key: "pending", header: "With District / Applicant", width: 13, kind: "number" as const, align: "right" as const },
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
          ["Source", x.source === "SELF" ? "Self-registered" : x.source === "BULK" ? "Bulk upload by district centre" : "Entered by district centre"],
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

// ---------------------------------------------------------------- sector demand

async function sectorDemandReport(user: User, f: BuyerFilters): Promise<Report> {
  let rows = await sectorDemandSummary(user);
  if (f.sector) rows = rows.filter((r) => r.id === f.sector);
  const filters = f.sector && rows[0] ? [`Sector: ${rows[0].name}`] : [];
  const productRows = rows.flatMap((r) => r.products.map((p) => ({ sector: r.name, ...p })));
  return {
    ...base("sector-demand", user, filters),
    kpis: [
      { label: "Sectors with demand", value: rows.filter((r) => r.buyers).length, tone: "blue" },
      { label: "Buyer-sector requirements", value: rows.reduce((a, r) => a + r.buyers, 0), tone: "violet" },
      { label: "Distinct products requested", value: productRows.length, tone: "yellow" },
      { label: "Products with a matching seller", value: productRows.filter((p) => p.sellers > 0).length, tone: "green" },
    ],
    tables: [
      {
        name: "Sector Summary", heading: "1. Sector summary",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "sector", header: "Sector", width: 26 },
          { key: "buyers", header: "Buyers (incl. Pending)", width: 11, kind: "number", align: "right" },
          { key: "approved", header: "Approved Buyers", width: 11, kind: "number", align: "right" },
          { key: "pending", header: "Under Review", width: 11, kind: "number", align: "right" },
          { key: "top", header: "Most Requested Products (buyers)", width: 52 },
          { key: "sellers", header: "Approved Sellers", width: 11, kind: "number", align: "right" },
          { key: "ratio", header: "Sellers per Approved Buyer", width: 13, align: "right" },
        ],
        rows: rows.map((r, i) => ({
          sl: i + 1, sector: r.name, buyers: r.buyers, approved: r.approvedReqs, pending: r.pendingReqs,
          top: r.products.slice(0, 6).map((p) => `${p.product} (${p.buyers})`).join(", "), sellers: r.sellers,
          ratio: r.approvedReqs ? (r.sellers / r.approvedReqs).toFixed(1) : "—",
        })),
        totals: {
          sector: "Total", buyers: rows.reduce((a, r) => a + r.buyers, 0), approved: rows.reduce((a, r) => a + r.approvedReqs, 0),
          pending: rows.reduce((a, r) => a + r.pendingReqs, 0), sellers: rows.reduce((a, r) => a + r.sellers, 0),
        },
      },
      {
        name: "Product Demand", heading: "2. Product-wise demand",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "sector", header: "Sector", width: 24 },
          { key: "product", header: "Product", width: 28 },
          { key: "buyers", header: "Buyers", width: 9, kind: "number", align: "right" },
          { key: "names", header: "Requested By", width: 60 },
          { key: "sellers", header: "Sellers Offering", width: 12, kind: "number", align: "right" },
        ],
        rows: productRows.map((p, i) => ({ sl: i + 1, sector: p.sector, product: p.product, buyers: p.buyers, names: p.buyerNames.join(", "), sellers: p.sellers })),
      },
    ],
  };
}

// ---------------------------------------------------------------- product demand

async function productDemandReport(user: User, f: BuyerFilters & { view?: string }): Promise<Report> {
  const all = await productDemand(user);
  const q = f.q?.trim().toLowerCase();
  const rows = all.filter((r) => (!f.sector || r.sectorId === f.sector) && (!q || r.product.toLowerCase().includes(q)) &&
    (f.view === "gaps" ? !r.sellers.length : f.view === "approved" ? r.approvedBuyers > 0 : true));
  const filters: string[] = [];
  if (f.sector && rows[0]) filters.push(`Sector: ${rows[0].sectorName}`);
  if (q) filters.push(`Search: "${f.q}"`);
  if (f.view === "gaps") filters.push("Supply gaps only");
  if (f.view === "approved") filters.push("With approved buyer demand");
  return {
    ...base("product-demand", user, filters),
    kpis: [
      { label: "Products requested", value: rows.length, tone: "blue" },
      { label: "With approved demand", value: rows.filter((r) => r.approvedBuyers).length, tone: "green" },
      { label: "Supplied by approved sellers", value: rows.filter((r) => r.sellers.length).length, tone: "violet" },
      { label: "Supply gaps", value: rows.filter((r) => !r.sellers.length).length, tone: "red" },
    ],
    tables: [{
      name: "Product Demand",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "product", header: "Product", width: 24 },
        { key: "sector", header: "Sector", width: 22 },
        { key: "total", header: "Buyers", width: 8, kind: "number", align: "right" },
        { key: "approved", header: "Approved", width: 9, kind: "number", align: "right" },
        { key: "pending", header: "Pending", width: 8, kind: "number", align: "right" },
        { key: "countries", header: "Countries", width: 24 },
        { key: "buyers", header: "Buyers Asking", width: 30 },
        { key: "nSellers", header: "Approved Sellers", width: 9, kind: "number", align: "right" },
        { key: "sellers", header: "Sellers Offering (District)", width: 34 },
      ],
      rows: rows.map((r, i) => ({
        sl: i + 1, product: r.product, sector: r.sectorName, total: r.approvedBuyers + r.pendingBuyers, approved: r.approvedBuyers, pending: r.pendingBuyers,
        countries: r.countries.join(", "),
        buyers: r.buyers.map((b) => `${b.name}${b.approved ? "" : " (pending)"}`).join("\n"),
        nSellers: r.sellers.length,
        sellers: r.sellers.length ? r.sellers.map((s) => `${s.name} (${s.district})`).join("\n") : "NO SUPPLIER YET",
      })),
    }],
  };
}

// ---------------------------------------------------------------- Directorate insights

async function insightsReport(user: User): Promise<Report> {
  const d = await buildInsights(user);
  const label = { ready: "Ready", sector: "Sector match only", short: "Short of sellers" } as const;
  const num = (key: string, header: string, width = 10) => ({ key, header, width, kind: "number" as const, align: "right" as const });
  return {
    ...base("insights", user, []),
    kpis: [
      { label: "Buyers ready for matchmaking", value: `${d.summary.ready} / ${d.summary.approvedBuyers}`, tone: "green" },
      { label: "Buyers short of sellers", value: d.summary.short, tone: "red" },
      { label: "Products with no supplier", value: `${d.summary.productGaps} / ${d.summary.products}`, tone: "yellow" },
      { label: "Pending > 7 days", value: d.summary.overdue, tone: "violet" },
    ],
    tables: [
      {
        name: "Matchmaking Readiness", heading: `1. Matchmaking readiness (target ${d.target} sellers per buyer)`,
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Buyer No.", width: 19, kind: "mono" },
          { key: "name", header: "Buyer", width: 26 }, { key: "country", header: "Country", width: 15 },
          { key: "sectors", header: "Approved Sectors", width: 34 },
          num("sectorSellers", "Sellers in Sectors", 12), num("productSellers", "Product-matched Sellers", 13),
          { key: "status", header: "Status", width: 16 },
        ],
        rows: d.readiness.map((r, i) => ({ sl: i + 1, approvedNo: r.approvedNo, name: r.name, country: r.country, sectors: r.sectors.join("\n"),
          sectorSellers: r.sectorSellers, productSellers: r.productSellers, status: label[r.status] })),
      },
      {
        name: "Sector Supply Gaps", heading: "2. Sectors short of sellers",
        columns: [
          { key: "sector", header: "Sector", width: 28 }, num("buyers", "Approved Buyers"), num("needed", "Sellers Needed"),
          num("sellers", "Approved Sellers"), num("exp", "Export-ready"), num("shortfall", "Shortfall"),
        ],
        rows: d.sectorGaps.map((g) => ({ sector: g.name, buyers: g.approvedBuyers, needed: g.needed, sellers: g.sellers, exp: g.exportReady, shortfall: g.shortfall })),
      },
      {
        name: "Products No Supplier", heading: "3. Requested products with no approved supplier",
        columns: [
          { key: "product", header: "Product", width: 26 }, { key: "sector", header: "Sector", width: 24 },
          num("buyers", "Buyers"), num("approved", "Approved"), { key: "countries", header: "Countries", width: 30 },
        ],
        rows: d.productGaps.map((p) => ({ product: p.product, sector: p.sectorName, buyers: p.approvedBuyers + p.pendingBuyers, approved: p.approvedBuyers, countries: p.countries.join(", ") })),
      },
      {
        name: "District x Sector", heading: "4. Approved sellers by district and sector",
        columns: [{ key: "district", header: "District", width: 18 },
          ...d.supplySectors.map((s, i) => num(`c${i}`, s.name, 10)), num("total", "Sellers")],
        rows: d.districtSector.map((r) => ({ district: r.district, total: r.total, ...Object.fromEntries(r.cells.map((v, i) => [`c${i}`, v])) })),
      },
      {
        name: "Country x Sector", heading: "5. Buyer requirements by country and sector",
        columns: [{ key: "country", header: "Country", width: 18 },
          ...d.demandSectors.map((s, i) => num(`c${i}`, s.name, 11)), num("total", "All Sectors")],
        rows: d.countrySector.map((r) => ({ country: r.country, total: r.total, ...Object.fromEntries(r.cells.map((v, i) => [`c${i}`, v])) })),
      },
      {
        name: "Certifications", heading: "6. Certifications required by buyers",
        columns: [{ key: "name", header: "Certification", width: 34 }, num("all", "All Requirements", 14), num("approved", "Approved", 12)],
        rows: d.certifications.map((c) => ({ name: c.name, all: c.all, approved: c.approved })),
      },
      {
        name: "Turnaround", heading: "7. Average turnaround (including correction rounds)",
        columns: [{ key: "stage", header: "Stage", width: 50 }, { key: "days", header: "Average Days", width: 14, align: "right" }, num("n", "Files", 10)],
        rows: d.turnaround.map((t) => ({ stage: t.stage, days: t.days === null ? "" : t.days.toFixed(1), n: t.n })),
      },
      {
        name: "Pending Ageing", heading: "8. Pending now, by waiting time",
        columns: [{ key: "stage", header: "Stage", width: 40 }, ...AGE_BUCKETS.map((b, i) => num(`b${i}`, b, 11)), num("total", "Total"), num("oldest", "Oldest (days)", 12)],
        rows: d.ageing.map((a) => ({ stage: a.stage, total: a.total, oldest: a.oldest ?? "", ...Object.fromEntries(a.buckets.map((v, i) => [`b${i}`, v])) })),
      },
    ],
  };
}
