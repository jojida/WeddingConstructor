-- Серия писем после регистрации (lib/lifecycleEmails.ts): какие письма уже
-- ушли по какому приглашению. Отдельной таблицей, а не колонками в Invitation,
-- чтобы новое письмо в серии не требовало правки схемы.
CREATE TABLE IF NOT EXISTS "EmailEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailEvent_invitationId_kind_key" ON "EmailEvent"("invitationId", "kind");
CREATE INDEX IF NOT EXISTS "EmailEvent_userId_sentAt_idx" ON "EmailEvent"("userId", "sentAt");
