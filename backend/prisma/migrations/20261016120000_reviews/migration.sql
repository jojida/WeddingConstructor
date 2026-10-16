-- Отзывы пар о сервисе (lib/reviews.ts). Идемпотентно: таблицу создаёт сам бэкенд
-- при запуске (ensureSchema), деплой миграции не запускает.
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "names" TEXT NOT NULL,
    "templateId" TEXT NOT NULL DEFAULT '',
    "publish" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Review_invitationId_key" ON "Review"("invitationId");
CREATE INDEX IF NOT EXISTS "Review_status_updatedAt_idx" ON "Review"("status", "updatedAt");
