-- CreateTable
CREATE TABLE "EventDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breaks" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "NodalOfficer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NodalOfficer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketNo" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "pavilionNo" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "markedAt" DATETIME,
    "markedById" TEXT,
    "note" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledMeeting_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledMeeting_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledMeeting_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuyerDayAttendance" (
    "buyerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,
    "markedById" TEXT,
    "markedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("buyerId", "day"),
    CONSTRAINT "BuyerDayAttendance_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuyerDayAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    CONSTRAINT "Buyer_nodalOfficerId_fkey" FOREIGN KEY ("nodalOfficerId") REFERENCES "NodalOfficer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Buyer" ("approvedAt", "approvedNo", "approvedSeq", "basicApprovedAt", "basicSubmittedAt", "country", "createdAt", "id", "name", "pocDesignation", "pocEmail", "pocMobile", "pocName", "recommendedAt", "regNo", "reqSubmittedAt", "seq", "signupEmail", "status", "updatedAt", "userId") SELECT "approvedAt", "approvedNo", "approvedSeq", "basicApprovedAt", "basicSubmittedAt", "country", "createdAt", "id", "name", "pocDesignation", "pocEmail", "pocMobile", "pocName", "recommendedAt", "regNo", "reqSubmittedAt", "seq", "signupEmail", "status", "updatedAt", "userId" FROM "Buyer";
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

-- CreateIndex
CREATE UNIQUE INDEX "EventDay_date_key" ON "EventDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "NodalOfficer_userId_key" ON "NodalOfficer"("userId");

-- CreateIndex
CREATE INDEX "Meeting_day_startAt_idx" ON "Meeting"("day", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_buyerId_sellerId_key" ON "Meeting"("buyerId", "sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledMeeting_ticketNo_key" ON "ScheduledMeeting"("ticketNo");

-- CreateIndex
CREATE INDEX "ScheduledMeeting_day_startAt_idx" ON "ScheduledMeeting"("day", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledMeeting_buyerId_sellerId_key" ON "ScheduledMeeting"("buyerId", "sellerId");
