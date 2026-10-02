-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN "approvedProfile" TEXT;

-- AlterTable
ALTER TABLE "RequirementItem" ADD COLUMN "approvedSnapshot" TEXT;
ALTER TABLE "RequirementItem" ADD COLUMN "returnedSnapshot" TEXT;

-- Backfill: sectors approved right now are unchanged since approval, so their
-- current content is the approved version.
UPDATE "RequirementItem" SET "approvedSnapshot" = json_object(
  'sectorId', "sectorId",
  'sectorName', (SELECT "name" FROM "Sector" WHERE "Sector"."id" = "RequirementItem"."sectorId"),
  'products', "products",
  'specifications', COALESCE("specifications", ''),
  'certifications', json("certifications"),
  'quantity', COALESCE("quantity", '')
) WHERE "status" = 'APPROVED';

UPDATE "Requirement" SET "approvedProfile" = json_object(
  'organisationType', COALESCE("organisationType", ''),
  'procurementInterests', COALESCE("procurementInterests", ''),
  'annualSourcingValue', COALESCE("annualSourcingValue", ''),
  'sourcingTimeline', COALESCE("sourcingTimeline", ''),
  'preferredEngagement', COALESCE("preferredEngagement", '')
) WHERE EXISTS (SELECT 1 FROM "RequirementItem" i WHERE i."requirementId" = "Requirement"."id" AND i."status" = 'APPROVED');
