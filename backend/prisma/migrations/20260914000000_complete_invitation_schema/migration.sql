-- AlterTable
ALTER TABLE "GuestResponse" ADD COLUMN "guestId" TEXT;

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "salutation" TEXT NOT NULL DEFAULT 'дорогие',
    "names" TEXT NOT NULL,
    "responseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Guest_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL DEFAULT '',
    "groomName" TEXT NOT NULL DEFAULT '',
    "brideName" TEXT NOT NULL DEFAULT '',
    "weddingDate" TEXT NOT NULL DEFAULT '',
    "weddingTime" TEXT NOT NULL DEFAULT '',
    "venue" TEXT NOT NULL DEFAULT '',
    "venueAddress" TEXT NOT NULL DEFAULT '',
    "mapLink" TEXT NOT NULL DEFAULT '',
    "story" TEXT NOT NULL DEFAULT '',
    "inviteText" TEXT NOT NULL DEFAULT '',
    "dressCode" TEXT NOT NULL DEFAULT '',
    "dressCodeColors" TEXT NOT NULL DEFAULT '[]',
    "dressCodePhoto" TEXT NOT NULL DEFAULT '',
    "schedule" TEXT NOT NULL DEFAULT '[]',
    "coverPhoto" TEXT NOT NULL DEFAULT '',
    "coverVideo" TEXT NOT NULL DEFAULT '',
    "galleryPhotos" TEXT NOT NULL DEFAULT '[]',
    "colorScheme" TEXT NOT NULL DEFAULT 'classic',
    "musicUrl" TEXT NOT NULL DEFAULT '',
    "enabledSections" TEXT NOT NULL DEFAULT '{"couple":true,"event":true,"schedule":true,"style":true,"gallery":true}',
    "customData" TEXT NOT NULL DEFAULT '{}',
    "paymentId" TEXT NOT NULL DEFAULT '',
    "paidAt" DATETIME,
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "customDomain" TEXT NOT NULL DEFAULT '',
    "notifyChannel" TEXT NOT NULL DEFAULT 'none',
    "notifyEmail" TEXT NOT NULL DEFAULT '',
    "notifyTelegramChatId" TEXT NOT NULL DEFAULT '',
    "telegramConnectToken" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invitation" ("brideName", "colorScheme", "coverPhoto", "createdAt", "dressCode", "galleryPhotos", "groomName", "id", "inviteText", "mapLink", "musicUrl", "paidAt", "paymentId", "plan", "schedule", "slug", "status", "story", "templateId", "title", "updatedAt", "userId", "venue", "venueAddress", "weddingDate", "weddingTime") SELECT "brideName", "colorScheme", "coverPhoto", "createdAt", "dressCode", "galleryPhotos", "groomName", "id", "inviteText", "mapLink", "musicUrl", "paidAt", "paymentId", "plan", "schedule", "slug", "status", "story", "templateId", "title", "updatedAt", "userId", "venue", "venueAddress", "weddingDate", "weddingTime" FROM "Invitation";
DROP TABLE "Invitation";
ALTER TABLE "new_Invitation" RENAME TO "Invitation";
CREATE UNIQUE INDEX "Invitation_slug_key" ON "Invitation"("slug");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash") SELECT "createdAt", "email", "id", "name", "passwordHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VerificationCode_email_key" ON "VerificationCode"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_token_key" ON "Guest"("token");

-- CreateIndex
CREATE INDEX "Guest_invitationId_idx" ON "Guest"("invitationId");

-- CreateIndex
CREATE INDEX "GuestResponse_guestId_idx" ON "GuestResponse"("guestId");
