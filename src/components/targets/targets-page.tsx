import { prisma } from "@/lib/prisma";
import { getTargets } from "@/lib/targets";
import { DISTRICT_NAMES } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { TargetsForm } from "./targets-form";

export async function TargetsPage() {
  const [t, approved] = await Promise.all([
    getTargets(),
    prisma.seller.groupBy({ by: ["district"], where: { status: "APPROVED" }, _count: true }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Directorate" title="Targets"
        subtitle={<>Set the approved-seller targets for the programme and for each district.{t.updatedAt && <> Last updated {fmtDateTime(t.updatedAt)}{t.updatedBy ? ` by ${t.updatedBy}` : ""}.</>}</>} />
      <TargetsForm
        initial={{ sellers: t.sellers, buyers: t.buyers, sellersPerBuyer: t.sellersPerBuyer, district: t.district }}
        districts={DISTRICT_NAMES}
        approved={Object.fromEntries(approved.map((a) => [a.district, a._count]))}
      />
    </>
  );
}
