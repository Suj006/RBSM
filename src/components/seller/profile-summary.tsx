import { Badge, DL } from "@/components/ui";
import { CONSTITUTIONS, GENDERS, optLabel, SOCIAL_CATEGORIES, UNIT_CATEGORIES, UNIT_TYPES } from "@/lib/config";
import { fmtDate, parseCerts } from "@/lib/format";

type P = {
  iecNo: string | null; certifications: string; exportExperience: boolean; exportCountries: string; exportedProducts: string | null;
  promoterGender: string | null; promoterDob: Date | null; socialCategory: string | null; speciallyAbled: boolean | null;
  block: string | null; constitution: string | null; unitCategory: string | null; unitType: string | null; profileCompletedAt: Date | null;
};

const dash = (v: string) => v || <span className="text-slate-400">Not given</span>;

/** Export history, IEC number and certifications (collected at registration). */
export function ExportCredentials({ s }: { s: Pick<P, "iecNo" | "certifications" | "exportExperience" | "exportCountries" | "exportedProducts"> }) {
  const certs = parseCerts(s.certifications);
  const countries = parseCerts(s.exportCountries);
  return (
    <DL cols={2} items={[
      ...(s.exportExperience ? [
        { label: `Countries exported to${countries.length ? ` (${countries.length})` : ""}`, value: countries.length
          ? <div className="flex flex-wrap gap-1.5">{countries.map((c) => <Badge key={c} tone="blue">{c}</Badge>)}</div> : dash("") },
        { label: "Products exported", value: dash(s.exportedProducts ?? "") },
      ] : []),
      { label: "IEC number", value: s.iecNo ? <span className="font-mono">{s.iecNo}</span> : dash("") },
      { label: "Quality / product certifications", value: certs.length
        ? <div className="flex flex-wrap gap-1.5">{certs.map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>
        : <span className="text-slate-400">None</span> },
    ]} />
  );
}

/** Promoter and unit profile completed by the approved seller. */
export function ProfileDetails({ s, personal = true }: { s: P; personal?: boolean }) {
  if (!s.profileCompletedAt) return null;
  return (
    <DL cols={3} items={[
      ...(personal ? [
        { label: "Gender of the promoter", value: dash(optLabel(GENDERS, s.promoterGender)) },
        { label: "Date of birth", value: dash(s.promoterDob ? fmtDate(s.promoterDob) : "") },
        { label: "Social category", value: dash(optLabel(SOCIAL_CATEGORIES, s.socialCategory)) },
        { label: "Specially abled", value: s.speciallyAbled === null ? dash("") : s.speciallyAbled ? "Yes" : "No" },
      ] : []),
      { label: "Block", value: dash(s.block ?? "") },
      { label: "Constitution of the unit", value: dash(optLabel(CONSTITUTIONS, s.constitution)) },
      { label: "Category of the unit", value: dash(optLabel(UNIT_CATEGORIES, s.unitCategory)) },
      { label: "Unit type", value: dash(optLabel(UNIT_TYPES, s.unitType)) },
      { label: "Profile completed on", value: fmtDate(s.profileCompletedAt) },
    ]} />
  );
}
