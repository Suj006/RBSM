-- AlterTable
ALTER TABLE "User" ADD COLUMN "district" TEXT;

-- CreateTable
CREATE TABLE "Seller" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Seller_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SellerProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "products" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SellerProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellerProduct_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SellerLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerLog_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellerLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Seller_seq_key" ON "Seller"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_regNo_key" ON "Seller"("regNo");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_udyamNo_key" ON "Seller"("udyamNo");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_approvedSeq_key" ON "Seller"("approvedSeq");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_approvedNo_key" ON "Seller"("approvedNo");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");

-- CreateIndex
CREATE INDEX "Seller_district_status_idx" ON "Seller"("district", "status");

-- CreateIndex
CREATE INDEX "Seller_status_idx" ON "Seller"("status");

-- CreateIndex
CREATE INDEX "SellerProduct_sectorId_idx" ON "SellerProduct"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerProduct_sellerId_sectorId_key" ON "SellerProduct"("sellerId", "sectorId");

-- CreateIndex
CREATE INDEX "SellerLog_sellerId_createdAt_idx" ON "SellerLog"("sellerId", "createdAt");
