-- CreateTable
CREATE TABLE "Mou" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "mouNo" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sectorId" TEXT,
    "meetingId" TEXT,
    "goods" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" REAL,
    "orderMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nodalVerifiedAt" DATETIME,
    "nodalVerifiedById" TEXT,
    "fieoApprovedAt" DATETIME,
    "fieoApprovedById" TEXT,
    "approvedAt" DATETIME,
    "returnComment" TEXT,
    "returnedAt" DATETIME,
    "returnedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mou_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mou_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mou_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mou_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ScheduledMeeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mou_nodalVerifiedById_fkey" FOREIGN KEY ("nodalVerifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mou_fieoApprovedById_fkey" FOREIGN KEY ("fieoApprovedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mou_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Mou_seq_key" ON "Mou"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "Mou_mouNo_key" ON "Mou"("mouNo");

-- CreateIndex
CREATE INDEX "Mou_status_idx" ON "Mou"("status");

-- CreateIndex
CREATE INDEX "Mou_buyerId_idx" ON "Mou"("buyerId");

-- CreateIndex
CREATE INDEX "Mou_sellerId_idx" ON "Mou"("sellerId");
