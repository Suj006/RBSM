// Colours shared by the Excel and PDF reports (TRADEX logo palette).
export const C = {
  ink: "0F1B2D",
  brand: "237D32",
  brandDark: "1E632B",
  brandLight: "EEFAF0",
  red: "D62A2A",
  yellow: "DCC72B",
  green: "3CB54A",
  blue: "2EA3E6",
  muted: "64748B",
  border: "CBD5E1",
  zebra: "F6F8F7",
  white: "FFFFFF",
};

/** Fill / text colours for status cells, by tone. */
export const TONE: Record<string, { fill: string; text: string }> = {
  slate: { fill: "F1F5F9", text: "334155" },
  blue: { fill: "E0F2FE", text: "075985" },
  amber: { fill: "FEF3C7", text: "92400E" },
  yellow: { fill: "FEF9C3", text: "854D0E" },
  red: { fill: "FEE2E2", text: "B91C1C" },
  green: { fill: "DCFCE7", text: "166534" },
  violet: { fill: "EDE9FE", text: "5B21B6" },
};
