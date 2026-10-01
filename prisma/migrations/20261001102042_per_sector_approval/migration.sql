-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RequirementItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requirementId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "products" TEXT NOT NULL,
    "specifications" TEXT,
    "certifications" TEXT NOT NULL DEFAULT '[]',
    "quantity" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "recommendedAt" DATETIME,
    "approvedAt" DATETIME,
    "everApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequirementItem_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequirementItem_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RequirementItem" ("certifications", "id", "products", "quantity", "requirementId", "sectorId", "sortOrder", "specifications") SELECT "certifications", "id", "products", "quantity", "requirementId", "sectorId", "sortOrder", "specifications" FROM "RequirementItem";
DROP TABLE "RequirementItem";
ALTER TABLE "new_RequirementItem" RENAME TO "RequirementItem";
CREATE INDEX "RequirementItem_status_idx" ON "RequirementItem"("status");
CREATE UNIQUE INDEX "RequirementItem_requirementId_sectorId_key" ON "RequirementItem"("requirementId", "sectorId");
CREATE TABLE "new_ReviewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "itemId" TEXT,
    "sectorName" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewLog_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RequirementItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReviewLog" ("action", "actorId", "actorRole", "buyerId", "comment", "createdAt", "id") SELECT "action", "actorId", "actorRole", "buyerId", "comment", "createdAt", "id" FROM "ReviewLog";
DROP TABLE "ReviewLog";
ALTER TABLE "new_ReviewLog" RENAME TO "ReviewLog";
CREATE INDEX "ReviewLog_buyerId_createdAt_idx" ON "ReviewLog"("buyerId", "createdAt");
-- Data: move the requirement stage from the buyer to each sector row.
UPDATE "RequirementItem" SET
  "status" = (SELECT CASE b."status"
      WHEN 'REQ_SUBMITTED' THEN 'SUBMITTED'
      WHEN 'REQ_RETURNED' THEN 'FIEO_RETURNED'
      WHEN 'FIEO_RECOMMENDED' THEN 'FIEO_RECOMMENDED'
      WHEN 'DIC_RETURNED' THEN 'DIC_RETURNED'
      WHEN 'APPROVED' THEN 'APPROVED'
      ELSE 'DRAFT' END
    FROM "Requirement" r JOIN "Buyer" b ON b."id" = r."buyerId" WHERE r."id" = "RequirementItem"."requirementId"),
  "submittedAt" = (SELECT b."reqSubmittedAt" FROM "Requirement" r JOIN "Buyer" b ON b."id" = r."buyerId" WHERE r."id" = "RequirementItem"."requirementId"),
  "recommendedAt" = (SELECT b."recommendedAt" FROM "Requirement" r JOIN "Buyer" b ON b."id" = r."buyerId" WHERE r."id" = "RequirementItem"."requirementId"),
  "approvedAt" = (SELECT b."approvedAt" FROM "Requirement" r JOIN "Buyer" b ON b."id" = r."buyerId" WHERE r."id" = "RequirementItem"."requirementId");
UPDATE "RequirementItem" SET "everApproved" = true WHERE "status" = 'APPROVED';
UPDATE "Buyer" SET "status" = 'BASIC_APPROVED'
  WHERE "status" IN ('REQ_SUBMITTED', 'REQ_RETURNED', 'FIEO_RECOMMENDED', 'DIC_RETURNED');

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
