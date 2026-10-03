-- AlterTable
ALTER TABLE "Seller" ADD COLUMN "prefSubmittedAt" DATETIME;

-- CreateTable
CREATE TABLE "MatchSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SellerPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerPreference_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellerPreference_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublishedMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0,
    "slot" INTEGER NOT NULL,
    CONSTRAINT "PublishedMatch_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublishedMatch_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SellerPreference_buyerId_idx" ON "SellerPreference"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerPreference_sellerId_rank_key" ON "SellerPreference"("sellerId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "SellerPreference_sellerId_buyerId_key" ON "SellerPreference"("sellerId", "buyerId");

-- CreateIndex
CREATE INDEX "Match_sellerId_idx" ON "Match"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_buyerId_sellerId_key" ON "Match"("buyerId", "sellerId");

-- CreateIndex
CREATE INDEX "PublishedMatch_sellerId_idx" ON "PublishedMatch"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedMatch_buyerId_sellerId_key" ON "PublishedMatch"("buyerId", "sellerId");
