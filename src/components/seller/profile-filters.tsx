import { Select } from "@/components/ui";
import { UNIT_CATEGORIES, UNIT_TYPES } from "@/lib/config";
import type { SellerFilters } from "@/lib/seller-query";

/** Second row of seller filters: profile, unit category / type, promoter, IEC and certifications. */
export function ProfileFilters({ f, profile = true, prefix = "", personal = true }: {
  f: SellerFilters; profile?: boolean; prefix?: string;
  /** Promoter filters (women, SC / ST, specially abled) — not for FIEO. */
  personal?: boolean;
}) {
  return (
    <>
      {profile && (
        <Select name={`${prefix}profile`} defaultValue={f.profile ?? ""} aria-label="Seller profile">
          <option value="">Any profile status</option>
          <option value="done">Profile completed</option>
          <option value="pending">Profile pending with seller</option>
        </Select>
      )}
      <Select name={`${prefix}cat`} defaultValue={f.cat ?? ""} aria-label="Category of unit">
        <option value="">Any category (Micro / Small…)</option>
        {UNIT_CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
      <Select name={`${prefix}utype`} defaultValue={f.utype ?? ""} aria-label="Unit type">
        <option value="">Any unit type</option>
        {UNIT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
      {personal && <Select name={`${prefix}promoter`} defaultValue={f.promoter ?? ""} aria-label="Promoter">
        <option value="">All promoters</option>
        <option value="women">Women promoters</option>
        <option value="scst">SC / ST promoters</option>
        <option value="disabled">Specially abled promoters</option>
      </Select>}
      <Select name={`${prefix}iec`} defaultValue={f.iec ?? ""} aria-label="IEC number">
        <option value="">IEC: any</option>
        <option value="yes">IEC number given</option>
        <option value="no">No IEC number</option>
      </Select>
      <Select name={`${prefix}cert`} defaultValue={f.cert ?? ""} aria-label="Certifications">
        <option value="">Certifications: any</option>
        <option value="yes">Holds certifications</option>
        <option value="no">No certifications</option>
      </Select>
    </>
  );
}
