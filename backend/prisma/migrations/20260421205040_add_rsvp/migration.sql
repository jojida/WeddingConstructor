-- CreateTable
CREATE TABLE "GuestResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "attending" BOOLEAN NOT NULL,
    "drinkChoice" TEXT NOT NULL DEFAULT '',
    "wishes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestResponse_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
