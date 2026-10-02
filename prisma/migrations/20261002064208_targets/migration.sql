-- CreateTable
CREATE TABLE "Target" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Target_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
