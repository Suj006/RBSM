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
