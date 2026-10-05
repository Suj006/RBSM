/** MoU money formats — safe for client components too. */

/** US$ 1,250,000 / ₹ 1,10,00,000 */
export const fmtUsd = (v: number) => `US$ ${Math.round(v).toLocaleString("en-US")}`;
export const fmtInr = (v: number) => `₹ ${Math.round(v).toLocaleString("en-IN")}`;
/** Compact: $1.25M, ₹11.0 Cr, ₹8.4 L */
export const shortUsd = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}K` : `$${Math.round(v)}`;
export const shortInr = (v: number) => v >= 1e7 ? `₹${(v / 1e7).toFixed(v >= 1e9 ? 0 : 2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : `₹${Math.round(v).toLocaleString("en-IN")}`;
