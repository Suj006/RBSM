const cell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString().replace("T", " ").slice(0, 16) : String(v);
  // Neutralise spreadsheet formula injection (phone numbers like +971… are left alone).
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s()-]+$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Builds a CSV download (UTF-8 with BOM so Excel shows accents correctly). */
export function csvResponse(filename: string, header: string[], rows: unknown[][]) {
  const body = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const stamp = () => new Date().toISOString().slice(0, 10);
