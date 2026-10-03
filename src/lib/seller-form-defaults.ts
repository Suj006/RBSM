// Shared by server pages and the client seller form (kept out of the "use client" module).
export type SellerFormValues = {
  id?: string;
  name: string; district: string; taluk: string; localBodyType: string; localBodyName: string; udyamNo: string;
  exportExperience: "" | "YES" | "NO";
  contactName: string; contactMobile: string; contactWhatsapp: string; contactEmail: string;
  products: { sectorId: string; products: string }[];
};

export const EMPTY_SELLER: SellerFormValues = {
  name: "", district: "", taluk: "", localBodyType: "", localBodyName: "", udyamNo: "", exportExperience: "",
  contactName: "", contactMobile: "", contactWhatsapp: "", contactEmail: "", products: [{ sectorId: "", products: "" }],
};

/** Form values for an existing seller record. */
export function sellerFormValues(s: {
  id: string; name: string; district: string; taluk: string; localBodyType: string; localBodyName: string; udyamNo: string;
  exportExperience: boolean; contactName: string; contactMobile: string; contactWhatsapp: string; contactEmail: string;
  products: { sectorId: string; products: string }[];
}): SellerFormValues {
  return {
    id: s.id, name: s.name, district: s.district, taluk: s.taluk, localBodyType: s.localBodyType, localBodyName: s.localBodyName,
    udyamNo: s.udyamNo, exportExperience: s.exportExperience ? "YES" : "NO", contactName: s.contactName, contactMobile: s.contactMobile,
    contactWhatsapp: s.contactWhatsapp, contactEmail: s.contactEmail, products: s.products.map((p) => ({ sectorId: p.sectorId, products: p.products })),
  };
}
