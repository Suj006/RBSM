-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Buyer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "regNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "signupEmail" TEXT NOT NULL,
    "pocName" TEXT,
    "pocDesignation" TEXT,
    "pocEmail" TEXT,
    "pocMobile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SIGNED_UP',
    "source" TEXT NOT NULL DEFAULT 'SELF',
    "createdById" TEXT,
    "basicSubmittedAt" DATETIME,
    "basicApprovedAt" DATETIME,
    "reqSubmittedAt" DATETIME,
    "recommendedAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedSeq" INTEGER,
    "approvedNo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "pavilionNo" INTEGER,
    "nodalOfficerId" TEXT,
    CONSTRAINT "Buyer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Buyer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Buyer_nodalOfficerId_fkey" FOREIGN KEY ("nodalOfficerId") REFERENCES "NodalOfficer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Buyer" ("approvedAt", "approvedNo", "approvedSeq", "basicApprovedAt", "basicSubmittedAt", "country", "createdAt", "id", "name", "nodalOfficerId", "pavilionNo", "pocDesignation", "pocEmail", "pocMobile", "pocName", "recommendedAt", "regNo", "reqSubmittedAt", "seq", "signupEmail", "status", "updatedAt", "userId") SELECT "approvedAt", "approvedNo", "approvedSeq", "basicApprovedAt", "basicSubmittedAt", "country", "createdAt", "id", "name", "nodalOfficerId", "pavilionNo", "pocDesignation", "pocEmail", "pocMobile", "pocName", "recommendedAt", "regNo", "reqSubmittedAt", "seq", "signupEmail", "status", "updatedAt", "userId" FROM "Buyer";
DROP TABLE "Buyer";
ALTER TABLE "new_Buyer" RENAME TO "Buyer";
CREATE UNIQUE INDEX "Buyer_userId_key" ON "Buyer"("userId");
CREATE UNIQUE INDEX "Buyer_seq_key" ON "Buyer"("seq");
CREATE UNIQUE INDEX "Buyer_regNo_key" ON "Buyer"("regNo");
CREATE UNIQUE INDEX "Buyer_signupEmail_key" ON "Buyer"("signupEmail");
CREATE UNIQUE INDEX "Buyer_approvedSeq_key" ON "Buyer"("approvedSeq");
CREATE UNIQUE INDEX "Buyer_approvedNo_key" ON "Buyer"("approvedNo");
CREATE UNIQUE INDEX "Buyer_pavilionNo_key" ON "Buyer"("pavilionNo");
CREATE INDEX "Buyer_status_idx" ON "Buyer"("status");
CREATE INDEX "Buyer_country_idx" ON "Buyer"("country");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
