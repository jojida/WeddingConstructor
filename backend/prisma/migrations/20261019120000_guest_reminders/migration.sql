-- Напоминание гостям перед свадьбой (lib/reminders.ts). Идемпотентно: таблицы создаёт
-- сам бэкенд при запуске (ensureSchema), деплой миграции не запускает.
CREATE TABLE IF NOT EXISTS "ReminderSettings" (
    "invitationId" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "days" TEXT NOT NULL DEFAULT '7',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderSettings_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "GuestReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "invitationId" TEXT,
    "responseId" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "telegramChatId" TEXT NOT NULL DEFAULT '',
    "answer" TEXT NOT NULL DEFAULT '',
    "answeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestReminder_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuestReminder_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "GuestResponse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuestReminder_token_key" ON "GuestReminder"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "GuestReminder_responseId_key" ON "GuestReminder"("responseId");
CREATE INDEX IF NOT EXISTS "GuestReminder_invitationId_idx" ON "GuestReminder"("invitationId");

CREATE TABLE IF NOT EXISTS "ReminderSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reminderId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderSend_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "GuestReminder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReminderSend_reminderId_kind_key" ON "ReminderSend"("reminderId", "kind");
CREATE INDEX IF NOT EXISTS "ReminderSend_invitationId_channel_idx" ON "ReminderSend"("invitationId", "channel");
