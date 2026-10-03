import type { BuyerStatus, ItemStatus, ReviewAction, Role, SellerAction, SellerStatus } from "@/generated/prisma/enums";

type Tone = "slate" | "blue" | "amber" | "red" | "green" | "violet";

export const STATUS_META: Record<BuyerStatus, { label: string; tone: Tone; stage: number }> = {
  SIGNED_UP: { label: "Basic details pending", tone: "slate", stage: 1 },
  BASIC_SUBMITTED: { label: "Awaiting FIEO approval", tone: "amber", stage: 2 },
  BASIC_RETURNED: { label: "Basic details returned", tone: "red", stage: 1 },
  BASIC_APPROVED: { label: "Requirement stage", tone: "blue", stage: 3 },
  APPROVED: { label: "Approved buyer", tone: "green", stage: 4 },
};

export const ALL_STATUSES = Object.keys(STATUS_META) as BuyerStatus[];

export const ITEM_META: Record<ItemStatus, { label: string; short: string; tone: Tone; dot: string }> = {
  DRAFT: { label: "Draft — not submitted", short: "Draft", tone: "slate", dot: "bg-slate-400" },
  SUBMITTED: { label: "Awaiting FIEO recommendation", short: "With FIEO", tone: "amber", dot: "bg-tx-yellow" },
  FIEO_RETURNED: { label: "Returned by FIEO", short: "Returned", tone: "red", dot: "bg-tx-red" },
  FIEO_RECOMMENDED: { label: "Awaiting Directorate approval", short: "With Directorate", tone: "violet", dot: "bg-violet-500" },
  DIC_RETURNED: { label: "Returned by Directorate to FIEO", short: "Directorate returned", tone: "red", dot: "bg-orange-500" },
  APPROVED: { label: "Approved", short: "Approved", tone: "green", dot: "bg-tx-green" },
};

export const ALL_ITEM_STATUSES = Object.keys(ITEM_META) as ItemStatus[];

export const ACTION_LABEL: Record<ReviewAction, string> = {
  SIGNED_UP: "Signed up",
  BASIC_SUBMITTED: "Basic details submitted",
  BASIC_APPROVED: "Basic details approved",
  BASIC_RETURNED: "Basic details returned for correction",
  REQ_SUBMITTED: "Requirement submitted",
  REQ_RETURNED: "Requirement returned for correction",
  FIEO_RECOMMENDED: "Recommended to Directorate",
  DIC_RETURNED: "Returned to FIEO for re-verification",
  DIC_APPROVED: "Approved by Directorate",
  REQ_WITHDRAWN: "Requirement removed by buyer",
  REQ_MODIFIED: "Approved requirement reopened for changes",
};

export const ROLE_LABEL: Record<Role, string> = {
  BUYER: "Buyer",
  FIEO: "FIEO",
  DIC: "Directorate",
  ADMIN: "Administrator",
  DISTRICT: "District Industries Centre",
  SELLER: "Seller",
};

/** Short label for the portal badge in the sidebar. */
export const ROLE_BADGE: Record<Role, string> = {
  BUYER: "Buyer portal", FIEO: "FIEO portal", DIC: "Directorate portal", ADMIN: "Admin portal",
  DISTRICT: "District office", SELLER: "Seller portal",
};

export const ROLE_HOME: Record<Role, string> = {
  BUYER: "/buyer",
  FIEO: "/fieo",
  DIC: "/dic",
  ADMIN: "/admin",
  DISTRICT: "/district",
  SELLER: "/seller",
};

// Registration journey (buyer level). Sector requirements then go through
// their own FIEO → DIC approval, one by one.
export const JOURNEY = ["Sign up", "Basic details", "FIEO approval", "Sector requirements", "Approved buyer"] as const;

// Sector rows each reviewer acts on.
export const FIEO_ITEM_QUEUE: ItemStatus[] = ["SUBMITTED", "DIC_RETURNED"];
/** Submitted sector requirements still in verification (drafts excluded). */
export const ITEM_PENDING: ItemStatus[] = ["SUBMITTED", "FIEO_RETURNED", "FIEO_RECOMMENDED", "DIC_RETURNED"];
export const DIC_ITEM_QUEUE: ItemStatus[] = ["FIEO_RECOMMENDED"];
// Sector rows the Directorate can see at all.

export const canEditBasic = (s: BuyerStatus) => s === "SIGNED_UP" || s === "BASIC_RETURNED";
/** Buyer may work on sector requirements once FIEO has approved the basic details. */
export const canWorkOnRequirements = (s: BuyerStatus) => s === "BASIC_APPROVED" || s === "APPROVED";
/** Sector rows the buyer can edit or remove — anything not currently with a reviewer.
 *  Editing an approved sector sends it through approval again. */
export const ITEM_EDITABLE: ItemStatus[] = ["DRAFT", "FIEO_RETURNED", "APPROVED"];

// ---------------------------------------------------------------- sellers

export const SELLER_META: Record<SellerStatus, { label: string; short: string; tone: Tone; dot: string }> = {
  WITH_DISTRICT: { label: "Pending district recommendation", short: "With district", tone: "amber", dot: "bg-tx-yellow" },
  WITH_SELLER: { label: "Returned to applicant for correction", short: "With applicant", tone: "blue", dot: "bg-tx-blue" },
  RECOMMENDED: { label: "Awaiting Directorate approval", short: "With Directorate", tone: "violet", dot: "bg-violet-500" },
  RETURNED: { label: "Returned to district", short: "Returned", tone: "red", dot: "bg-tx-red" },
  APPROVED: { label: "Approved seller", short: "Approved", tone: "green", dot: "bg-tx-green" },
  REJECTED: { label: "Rejected", short: "Rejected", tone: "slate", dot: "bg-slate-400" },
};
export const ALL_SELLER_STATUSES = Object.keys(SELLER_META) as SellerStatus[];

export const SELLER_ACTION_LABEL: Record<SellerAction, string> = {
  REGISTERED: "Registered",
  UPDATED: "Details updated",
  SENT_TO_SELLER: "Returned to applicant for correction",
  RESUBMITTED: "Corrected and resubmitted by applicant",
  RECOMMENDED: "Recommended to Directorate",
  RETURNED: "Returned to district",
  APPROVED: "Approved — login allotted",
  REJECTED: "Rejected",
};

/** Seller records each role may see. FIEO sees sellers only once approved. */
export const SELLER_VISIBLE: Partial<Record<Role, SellerStatus[]>> = {
  FIEO: ["APPROVED"],
};
/** The district can edit (and recommend) these. */
export const SELLER_DISTRICT_EDITABLE: SellerStatus[] = ["WITH_DISTRICT", "RETURNED"];
/** Sellers still in verification (not yet approved or rejected). */
export const SELLER_PENDING: SellerStatus[] = ["WITH_DISTRICT", "WITH_SELLER", "RETURNED", "RECOMMENDED"];
/** An applicant with a temporary login can correct their own details in these (and resubmit to the district). */
export const SELLER_APPLICANT_EDITABLE: SellerStatus[] = ["WITH_DISTRICT", "WITH_SELLER"];
