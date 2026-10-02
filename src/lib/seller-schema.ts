import { z } from "zod";
import { DISTRICT_NAMES } from "@/lib/config";
import { emailField, englishText, indianMobile, orgName, personName, placeName, udyamField } from "@/lib/text";

/** One seller record — shared by the district form, self-registration and bulk upload. */
export const sellerSchema = z.object({
  name: orgName("Name of the seller"),
  district: z.string().refine((d) => DISTRICT_NAMES.includes(d), "Select a district."),
  taluk: placeName("Taluk"),
  localBodyType: z.enum(["PANCHAYAT", "MUNICIPALITY", "CORPORATION"], { message: "Select the local body type." }),
  localBodyName: placeName("Local body name"),
  udyamNo: udyamField(),
  exportExperience: z.enum(["YES", "NO"], { message: "Select Yes or No." }).transform((v) => v === "YES"),
  contactName: personName("Contact person name"),
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
});

export type SellerInput = z.input<typeof sellerSchema>;
export type SellerData = z.output<typeof sellerSchema>;
