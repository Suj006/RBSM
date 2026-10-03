import { z } from "zod";
import { CONSTITUTIONS, DISTRICT_NAMES, GENDERS, SOCIAL_CATEGORIES, UNIT_CATEGORIES, UNIT_TYPES } from "@/lib/config";
import { BLOCKS, canonical, TALUKS, urbanBodies } from "@/lib/kerala";
import { COUNTRIES } from "@/lib/countries";
import { emailField, englishText, indianMobile, orgName, personName, placeName, toPlainText, udyamField } from "@/lib/text";

/** Importer-Exporter Code: 10 letters / digits (the PAN for new IECs). Empty when not given. */
export const iecField = () =>
  z.string().transform((v) => toPlainText(v).toUpperCase().replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^([A-Z0-9]{10})?$/, "Enter the 10-character IEC number (letters and digits), e.g. ABCDE1234F."));

/** Quality / product certifications held (master names or typed-in). */
export const certificationsField = () =>
  z.array(englishText({ min: 1, max: 120, label: "Certification" })).max(30, "Up to 30 certifications.")
    .transform((xs) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))]);

/** Countries already exported to (from the world list). */
export const exportCountriesField = () =>
  z.array(z.string()).max(100, "Up to 100 countries.")
    .transform((xs) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))])
    .refine((xs) => xs.every((x) => COUNTRIES.includes(x)), "Select countries from the list.");

/** One seller record — shared by the district form, self-registration and bulk upload. */
export const sellerSchema = z.object({
  name: orgName("Name of the seller"),
  district: z.string().refine((d) => DISTRICT_NAMES.includes(d), "Select a district."),
  taluk: placeName("Taluk"),
  localBodyType: z.enum(["PANCHAYAT", "MUNICIPALITY", "CORPORATION"], { message: "Select the local body type." }),
  localBodyName: placeName("Local body name"),
  udyamNo: udyamField(),
  exportExperience: z.enum(["YES", "NO"], { message: "Select Yes or No." }).transform((v) => v === "YES"),
  exportCountries: exportCountriesField(),
  exportedProducts: englishText({ max: 1000, label: "Products exported", multiline: true }),
  iecNo: iecField(),
  certifications: certificationsField(),
  contactName: personName("Name of the promoter"),
  contactMobile: indianMobile("Mobile number"),
  contactWhatsapp: indianMobile("WhatsApp number"),
  contactEmail: emailField(),
  products: z
    .array(z.object({
      sectorId: z.string().min(1, "Select a sector."),
      products: englishText({ min: 2, max: 1000, label: "Products", multiline: true }),
    }))
    .min(1, "Add at least one sector with the products you are ready to export.")
    .max(25)
    .refine((xs) => new Set(xs.map((x) => x.sectorId)).size === xs.length, "Each sector can be added only once."),
}).superRefine((d, ctx) => {
  if (DISTRICT_NAMES.includes(d.district)) {
    if (!canonical(TALUKS[d.district], d.taluk)) ctx.addIssue({ code: "custom", path: ["taluk"], message: `Select a taluk of ${d.district}.` });
    const urban = urbanBodies(d.district, d.localBodyType);
    const kind = d.localBodyType === "CORPORATION" ? "corporation" : "municipality";
    if (d.localBodyType !== "PANCHAYAT" && !canonical(urban, d.localBodyName))
      ctx.addIssue({ code: "custom", path: ["localBodyName"], message: urban.length
        ? `Select the ${kind} from the list for ${d.district}.`
        : `${d.district} has no ${kind}; check the local body type.` });
  }
  if (d.exportExperience && !d.iecNo) ctx.addIssue({ code: "custom", path: ["iecNo"], message: "IEC number is required for sellers with export experience." });
  if (d.exportExperience && !d.exportCountries.length) ctx.addIssue({ code: "custom", path: ["exportCountries"], message: "Select the countries the unit has exported to." });
  if (d.exportExperience && d.exportedProducts.length < 2) ctx.addIssue({ code: "custom", path: ["exportedProducts"], message: "Enter the products the unit has exported." });
}).transform((d) => ({
  ...d,
  // Export history is kept only when the seller has export experience.
  exportCountries: JSON.stringify(d.exportExperience ? d.exportCountries : []),
  exportedProducts: d.exportExperience ? d.exportedProducts : null,
  taluk: canonical(TALUKS[d.district], d.taluk) ?? d.taluk,
  localBodyName: canonical(urbanBodies(d.district, d.localBodyType), d.localBodyName) ?? d.localBodyName,
  iecNo: d.iecNo || null,
  certifications: JSON.stringify(d.certifications),
}));

export type SellerInput = z.input<typeof sellerSchema>;
export type SellerData = z.output<typeof sellerSchema>;

const opt = (opts: readonly { value: string }[], message: string) =>
  z.string().refine((v) => opts.some((o) => o.value === v), message);

/** Profile completed by an approved seller (district is fixed by the record). */
export const sellerProfileSchema = (district: string, exportExperience: boolean) => z.object({
  promoterGender: opt(GENDERS, "Select the gender."),
  promoterDob: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), "Enter the date of birth.")
    .transform((v) => new Date(`${v}T00:00:00.000Z`))
    .refine((d) => {
      const age = (Date.now() - d.getTime()) / (365.25 * 86400000);
      return age >= 18 && age <= 100;
    }, "The promoter must be between 18 and 100 years old."),
  socialCategory: opt(SOCIAL_CATEGORIES, "Select the social category."),
  speciallyAbled: z.enum(["YES", "NO"], { message: "Select Yes or No." }).transform((v) => v === "YES"),
  block: z.string().refine((v) => !!canonical(BLOCKS[district], v), `Select a block of ${district}.`)
    .transform((v) => canonical(BLOCKS[district], v)!),
  constitution: opt(CONSTITUTIONS, "Select the constitution of the unit."),
  unitCategory: opt(UNIT_CATEGORIES, "Select the category of the unit."),
  unitType: opt(UNIT_TYPES, "Select the unit type."),
  iecNo: iecField(),
  certifications: certificationsField(),
  exportCountries: exportCountriesField(),
  exportedProducts: englishText({ max: 1000, label: "Products exported", multiline: true }),
}).superRefine((d, ctx) => {
  if (exportExperience && !d.iecNo) ctx.addIssue({ code: "custom", path: ["iecNo"], message: "IEC number is required for sellers with export experience." });
  if (exportExperience && !d.exportCountries.length) ctx.addIssue({ code: "custom", path: ["exportCountries"], message: "Select the countries the unit has exported to." });
  if (exportExperience && d.exportedProducts.length < 2) ctx.addIssue({ code: "custom", path: ["exportedProducts"], message: "Enter the products the unit has exported." });
}).transform((d) => ({
  ...d, iecNo: d.iecNo || null, certifications: JSON.stringify(d.certifications),
  exportCountries: JSON.stringify(exportExperience ? d.exportCountries : []), exportedProducts: exportExperience ? d.exportedProducts : null,
}));

export type SellerProfileData = z.output<ReturnType<typeof sellerProfileSchema>>;

