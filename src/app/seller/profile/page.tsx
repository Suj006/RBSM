import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { certificationNames } from "@/lib/masters";
import { localBodyLabel } from "@/lib/config";
import { fmtDateTime, parseCerts } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { Alert, PageHeader } from "@/components/ui";
import { SellerProfileForm } from "@/components/seller/profile-form";

export const metadata: Metadata = { title: "My profile" };

export default async function Page({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser("SELLER");
  const { done } = await searchParams;
  const s = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!s || s.status !== "APPROVED") redirect("/seller");
  const certs = await certificationNames();
  const first = !s.profileCompletedAt;
  return (
    <>
      <PageHeader back={{ href: "/seller", label: "Back to dashboard" }} eyebrow={`Seller no. ${s.approvedNo}`} title="My profile"
        subtitle="Promoter and unit details for the Directorate's records and for buyer–seller matchmaking." />
      {done && (
        <Alert tone="green" className="mb-6" title={done === "completed" ? "Profile completed — thank you" : "Profile updated"}>
          {done === "completed" ? "You can now send your buyer preferences when the buyer list is open." : "Your changes have been saved."}
        </Alert>
      )}
      {first ? (
        <Alert tone="amber" className="mb-6" title="Please complete your profile">
          A few promoter and unit details were not collected at registration. Fill them in below — the profile is needed before you can
          send your buyer preferences.
        </Alert>
      ) : !done && (
        <p className="mb-6 text-sm text-slate-500">Profile completed on {fmtDateTime(s.profileCompletedAt)}. You can update it at any time.</p>
      )}
      <SellerProfileForm first={first} certifications={certs}
        fixed={{
          contactName: s.contactName, contactMobile: fmtMobile(s.contactMobile), contactEmail: s.contactEmail, name: s.name, udyamNo: s.udyamNo,
          district: s.district, taluk: s.taluk, localBody: `${s.localBodyName} ${localBodyLabel(s.localBodyType)}`, exportExperience: s.exportExperience,
        }}
        initial={{
          promoterGender: s.promoterGender ?? "", promoterDob: s.promoterDob ? s.promoterDob.toISOString().slice(0, 10) : "",
          socialCategory: s.socialCategory ?? "", speciallyAbled: s.speciallyAbled === null ? "" : s.speciallyAbled ? "YES" : "NO",
          block: s.block ?? "", constitution: s.constitution ?? "", unitCategory: s.unitCategory ?? "", unitType: s.unitType ?? "",
          iecNo: s.iecNo ?? "", certifications: parseCerts(s.certifications),
          exportCountries: parseCerts(s.exportCountries), exportedProducts: s.exportedProducts ?? "",
        }} />
    </>
  );
}
