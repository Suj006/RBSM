-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Seller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "regNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "taluk" TEXT NOT NULL,
    "localBodyType" TEXT NOT NULL,
    "localBodyName" TEXT NOT NULL,
    "udyamNo" TEXT NOT NULL,
    "exportExperience" BOOLEAN NOT NULL,
    "exportCountries" TEXT NOT NULL DEFAULT '[]',
    "exportedProducts" TEXT,
    "iecNo" TEXT,
    "certifications" TEXT NOT NULL DEFAULT '[]',
    "promoterGender" TEXT,
    "promoterDob" DATETIME,
    "socialCategory" TEXT,
    "speciallyAbled" BOOLEAN,
    "block" TEXT,
    "constitution" TEXT,
    "unitCategory" TEXT,
    "unitType" TEXT,
    "profileCompletedAt" DATETIME,
    "contactName" TEXT NOT NULL,
    "contactMobile" TEXT NOT NULL,
    "contactWhatsapp" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WITH_DISTRICT',
    "recommendedAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedSeq" INTEGER,
    "approvedNo" TEXT,
    "userId" TEXT,
    "prefSubmittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Seller_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Seller" ("approvedAt", "approvedNo", "approvedSeq", "contactEmail", "contactMobile", "contactName", "contactWhatsapp", "createdAt", "createdById", "district", "exportExperience", "id", "localBodyName", "localBodyType", "name", "prefSubmittedAt", "recommendedAt", "regNo", "seq", "source", "status", "taluk", "udyamNo", "updatedAt", "userId") SELECT "approvedAt", "approvedNo", "approvedSeq", "contactEmail", "contactMobile", "contactName", "contactWhatsapp", "createdAt", "createdById", "district", "exportExperience", "id", "localBodyName", "localBodyType", "name", "prefSubmittedAt", "recommendedAt", "regNo", "seq", "source", "status", "taluk", "udyamNo", "updatedAt", "userId" FROM "Seller";
DROP TABLE "Seller";
ALTER TABLE "new_Seller" RENAME TO "Seller";
CREATE UNIQUE INDEX "Seller_seq_key" ON "Seller"("seq");
CREATE UNIQUE INDEX "Seller_regNo_key" ON "Seller"("regNo");
CREATE UNIQUE INDEX "Seller_udyamNo_key" ON "Seller"("udyamNo");
CREATE UNIQUE INDEX "Seller_approvedSeq_key" ON "Seller"("approvedSeq");
CREATE UNIQUE INDEX "Seller_approvedNo_key" ON "Seller"("approvedNo");
CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");
CREATE INDEX "Seller_district_status_idx" ON "Seller"("district", "status");
CREATE INDEX "Seller_status_idx" ON "Seller"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
