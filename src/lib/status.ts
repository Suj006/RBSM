import type { BuyerStatus, ReviewAction, Role } from "@/generated/prisma/enums";

type Tone = "slate" | "blue" | "amber" | "red" | "green" | "violet";

export const STATUS_META: Record<BuyerStatus, { label: string; tone: Tone; stage: number }> = {
  SIGNED_UP: { label: "Basic details pending", tone: "slate", stage: 1 },
  BASIC_SUBMITTED: { label: "Awaiting FIEO approval", tone: "amber", stage: 2 },
  BASIC_RETURNED: { label: "Basic details returned", tone: "red", stage: 1 },
  BASIC_APPROVED: { label: "Requirement pending", tone: "blue", stage: 3 },
  REQ_SUBMITTED: { label: "Awaiting FIEO recommendation", tone: "amber", stage: 4 },
  REQ_RETURNED: { label: "Requirement returned", tone: "red", stage: 3 },
  FIEO_RECOMMENDED: { label: "Awaiting DIC approval", tone: "violet", stage: 5 },
  DIC_RETURNED: { label: "Returned by DIC", tone: "red", stage: 4 },
  APPROVED: { label: "Approved buyer", tone: "green", stage: 6 },
};

export const ALL_STATUSES = Object.keys(STATUS_META) as BuyerStatus[];

export const ACTION_LABEL: Record<ReviewAction, string> = {
  SIGNED_UP: "Signed up",
  BASIC_SUBMITTED: "Basic details submitted",
  BASIC_APPROVED: "Basic details approved",
  BASIC_RETURNED: "Basic details returned for correction",
  REQ_SUBMITTED: "Detailed requirement submitted",
  REQ_RETURNED: "Requirement returned for correction",
  FIEO_RECOMMENDED: "Recommended to Directorate",
  DIC_RETURNED: "Returned to FIEO for re-verification",
  DIC_APPROVED: "Approved — added to RBSM buyer list",
};

export const ROLE_LABEL: Record<Role, string> = {
  BUYER: "Buyer",
  FIEO: "FIEO",
  DIC: "Directorate",
  ADMIN: "Administrator",
};

export const ROLE_HOME: Record<Role, string> = {
  BUYER: "/buyer",
  FIEO: "/fieo",
  DIC: "/dic",
  ADMIN: "/admin",
};

// Journey steps shown to buyers and reviewers.
export const JOURNEY = [
  "Sign up",
  "Basic details",
  "FIEO approval",
  "Detailed requirement",
  "FIEO recommendation",
  "DIC approval",
] as const;

// Statuses the FIEO desk must act on.
export const FIEO_ACTIONABLE: BuyerStatus[] = ["BASIC_SUBMITTED", "REQ_SUBMITTED", "DIC_RETURNED"];
// Statuses visible to the Directorate.
export const DIC_VISIBLE: BuyerStatus[] = ["FIEO_RECOMMENDED", "DIC_RETURNED", "APPROVED"];

export const canEditBasic = (s: BuyerStatus) => s === "SIGNED_UP" || s === "BASIC_RETURNED";
export const canEditRequirement = (s: BuyerStatus) => s === "BASIC_APPROVED" || s === "REQ_RETURNED";
