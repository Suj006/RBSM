-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduledMeeting" (
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
    "movedFrom" DATETIME,
    "movedAt" DATETIME,
    "movedById" TEXT,
    "replacesId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledMeeting_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledMeeting_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledMeeting_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduledMeeting_movedById_fkey" FOREIGN KEY ("movedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScheduledMeeting" ("buyerId", "createdAt", "day", "endAt", "id", "markedAt", "markedById", "note", "pavilionNo", "sellerId", "startAt", "status", "ticketNo", "updatedAt", "version") SELECT "buyerId", "createdAt", "day", "endAt", "id", "markedAt", "markedById", "note", "pavilionNo", "sellerId", "startAt", "status", "ticketNo", "updatedAt", "version" FROM "ScheduledMeeting";
DROP TABLE "ScheduledMeeting";
ALTER TABLE "new_ScheduledMeeting" RENAME TO "ScheduledMeeting";
CREATE UNIQUE INDEX "ScheduledMeeting_ticketNo_key" ON "ScheduledMeeting"("ticketNo");
CREATE INDEX "ScheduledMeeting_day_startAt_idx" ON "ScheduledMeeting"("day", "startAt");
CREATE UNIQUE INDEX "ScheduledMeeting_buyerId_sellerId_key" ON "ScheduledMeeting"("buyerId", "sellerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
