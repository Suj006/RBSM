const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST_OFFSET = 330 * 60 * 1000; // dates are shown in Indian Standard Time

const ist = (d: Date) => {
  const t = new Date(d.getTime() + IST_OFFSET);
  return { day: t.getUTCDate(), month: t.getUTCMonth(), year: t.getUTCFullYear(), h: t.getUTCHours(), m: t.getUTCMinutes() };
};
const two = (n: number) => String(n).padStart(2, "0");

/** 07 Sep 2026 */
export const fmtDate = (d?: Date | null) => {
  if (!d) return "—";
  const x = ist(d);
  return `${two(x.day)} ${MONTHS[x.month]} ${x.year}`;
};
/** 07 Sep 2026, 04:14 PM */
export const fmtDateTime = (d?: Date | null) => {
  if (!d) return "—";
  const x = ist(d);
  return `${fmtDate(d)}, ${two(x.h % 12 || 12)}:${two(x.m)} ${x.h < 12 ? "AM" : "PM"}`;
};
export const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export function parseCerts(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
