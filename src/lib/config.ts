// Event-level constants. Change here to re-brand for a later edition.
export const EVENT = {
  name: "TRADEX 2.0",
  programme: "Reverse Buyer Seller Meet",
  short: "RBSM",
  organiser: "Directorate of Industries & Commerce",
  partner: "Federation of Indian Export Organisations (FIEO)",
  // Buyer login IDs: Tradex2027-001, Tradex2027-002…
  usernamePrefix: "Tradex2027-",
  // Buyer registration numbers: RBSM-B-001…
  regNoPrefix: "RBSM-B-",
  // Approved buyer numbers: RBSM-Buyer-2026001…
  approvedPrefix: "RBSM-Buyer-",
  approvedYear: 2026,
  // Initial password e-mailed to every newly signed-up buyer (phase 1 only).
  defaultBuyerPassword: "pass@123",
  // Seller login IDs: Tradex2027-S001…; registration numbers RBSM-S-001…;
  // approved seller numbers RBSM-Seller-2026001…
  sellerUsernamePrefix: "Tradex2027-S",
  sellerRegNoPrefix: "RBSM-S-",
  sellerApprovedPrefix: "RBSM-Seller-",
  // Programme targets shown on dashboards (each buyer meets at least 10 sellers).
  targetSellers: 600,
  targetBuyers: 60,
  // Portal logo (file in /public). Replace with the official artwork when available.
  logo: "/tradex-logo.svg",
} as const;

export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const pad3 = (n: number) => String(n).padStart(3, "0");

export const buyerUsername = (seq: number) => `${EVENT.usernamePrefix}${pad3(seq)}`;
export const buyerRegNo = (seq: number) => `${EVENT.regNoPrefix}${pad3(seq)}`;
export const approvedBuyerNo = (seq: number) =>
  `${EVENT.approvedPrefix}${EVENT.approvedYear}${pad3(seq)}`;

export const sellerUsername = (seq: number) => `${EVENT.sellerUsernamePrefix}${pad3(seq)}`;
export const sellerRegNo = (seq: number) => `${EVENT.sellerRegNoPrefix}${pad3(seq)}`;
export const approvedSellerNo = (seq: number) => `${EVENT.sellerApprovedPrefix}${EVENT.approvedYear}${pad3(seq)}`;

/** The 14 districts of Kerala, with the code used in district login IDs (dic-tvm…). */
export const DISTRICTS = [
  { name: "Thiruvananthapuram", code: "tvm" },
  { name: "Kollam", code: "klm" },
  { name: "Pathanamthitta", code: "pta" },
  { name: "Alappuzha", code: "alp" },
  { name: "Kottayam", code: "ktm" },
  { name: "Idukki", code: "idk" },
  { name: "Ernakulam", code: "ekm" },
  { name: "Thrissur", code: "tsr" },
  { name: "Palakkad", code: "pkd" },
  { name: "Malappuram", code: "mlp" },
  { name: "Kozhikode", code: "kkd" },
  { name: "Wayanad", code: "wyd" },
  { name: "Kannur", code: "knr" },
  { name: "Kasaragod", code: "ksd" },
] as const;
export const DISTRICT_NAMES: readonly string[] = DISTRICTS.map((d) => d.name);

export const LOCAL_BODY_TYPES = [
  { value: "PANCHAYAT", label: "Panchayat" },
  { value: "MUNICIPALITY", label: "Municipality" },
  { value: "CORPORATION", label: "Corporation" },
] as const;
export const localBodyLabel = (v: string) => LOCAL_BODY_TYPES.find((t) => t.value === v)?.label ?? v;

export const ORGANISATION_TYPES = [
  "Importer",
  "Distributor / Wholesaler",
  "Retail Chain",
  "E-commerce Platform",
  "Manufacturer / OEM",
  "Trading House",
  "Government / Institutional Buyer",
  "Sourcing Agent",
  "Other",
] as const;

export const SOURCING_VALUES = [
  "Below USD 100,000",
  "USD 100,000 - 500,000",
  "USD 500,000 - 1 million",
  "USD 1 - 5 million",
  "USD 5 - 10 million",
  "Above USD 10 million",
] as const;

export const SOURCING_TIMELINES = [
  "Immediate (within 3 months)",
  "3 - 6 months",
  "6 - 12 months",
  "More than 12 months",
  "Exploratory",
] as const;

export const ENGAGEMENT_TYPES = [
  "Regular / long-term supply",
  "One-time / trial order",
  "Private label / contract manufacturing",
  "Joint venture / partnership",
  "Distribution / agency",
] as const;
