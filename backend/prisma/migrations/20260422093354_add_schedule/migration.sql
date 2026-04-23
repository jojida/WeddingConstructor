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
    "schedule" TEXT NOT NULL DEFAULT '[]',
    "coverPhoto" TEXT NOT NULL DEFAULT '',
    "galleryPhotos" TEXT NOT NULL DEFAULT '[]',
    "colorScheme" TEXT NOT NULL DEFAULT 'classic',
    "musicUrl" TEXT NOT NULL DEFAULT '',
    "paymentId" TEXT NOT NULL DEFAULT '',
    "paidAt" DATETIME,
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invitation" ("brideName", "colorScheme", "coverPhoto", "createdAt", "dressCode", "galleryPhotos", "groomName", "id", "inviteText", "mapLink", "musicUrl", "paidAt", "paymentId", "plan", "slug", "status", "story", "templateId", "title", "updatedAt", "userId", "venue", "venueAddress", "weddingDate", "weddingTime") SELECT "brideName", "colorScheme", "coverPhoto", "createdAt", "dressCode", "galleryPhotos", "groomName", "id", "inviteText", "mapLink", "musicUrl", "paidAt", "paymentId", "plan", "slug", "status", "story", "templateId", "title", "updatedAt", "userId", "venue", "venueAddress", "weddingDate", "weddingTime" FROM "Invitation";
DROP TABLE "Invitation";
ALTER TABLE "new_Invitation" RENAME TO "Invitation";
CREATE UNIQUE INDEX "Invitation_slug_key" ON "Invitation"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
