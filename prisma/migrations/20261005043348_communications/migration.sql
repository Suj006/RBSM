-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "buyerId" TEXT,
    "sellerId" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hiddenAt" DATETIME,
    "hiddenById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationRead" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL,

    PRIMARY KEY ("conversationId", "userId"),
    CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "buyerId" TEXT,
    "audience" TEXT NOT NULL,
    "audienceLabel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Announcement_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnouncementRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME,
    CONSTRAINT "AnnouncementRecipient_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT,
    "announcementId" TEXT,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Conversation_kind_buyerId_sellerId_idx" ON "Conversation"("kind", "buyerId", "sellerId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

-- CreateIndex
CREATE INDEX "AnnouncementRecipient_userId_readAt_idx" ON "AnnouncementRecipient"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRecipient_announcementId_userId_key" ON "AnnouncementRecipient"("announcementId", "userId");
