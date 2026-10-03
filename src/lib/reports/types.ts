import type { BuyerStatus, ItemStatus, SellerStatus } from "@/generated/prisma/enums";

export type ColumnKind = "text" | "mono" | "number" | "percent" | "date" | "datetime" | "buyerStatus" | "itemStatus" | "sellerStatus";

export type Column = {
  key: string;
  header: string;
  /** Width in Excel characters; also the relative width in PDF. */
  width: number;
  kind?: ColumnKind;
  align?: "left" | "center" | "right";
  /** Excel only: left out of the PDF where an A4 page cannot hold every column. */
  excelOnly?: boolean;
};

export type Row = Record<string, string | number | Date | null | undefined | BuyerStatus | ItemStatus | SellerStatus>;

export type Table = {
  /** Excel sheet name (max 31 chars) and PDF section heading. */
  name: string;
  heading?: string;
  columns: Column[];
  rows: Row[];
  /** Optional closing row, e.g. totals. */
  totals?: Row;
};

export type Kpi = { label: string; value: string | number; tone?: "green" | "red" | "yellow" | "blue" | "slate" | "violet" };

export type Report = {
  id: string;
  title: string;
  /** Short description printed under the title. */
  description: string;
  generatedAt: Date;
  generatedBy: string;
  filters: string[];
  kpis: Kpi[];
  tables: Table[];
  orientation: "landscape" | "portrait";
  fileName: string;
};
