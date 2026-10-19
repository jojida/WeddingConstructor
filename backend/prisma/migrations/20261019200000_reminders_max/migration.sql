-- Напоминание гостям в MAX (lib/maxBot.ts): user_id гостя в мессенджере. Для чистой установки.
-- В рабочую базу колонку дописывает сам бэкенд при запуске (src/lib/ensureSchema.ts).
ALTER TABLE "GuestReminder" ADD COLUMN "maxUserId" TEXT NOT NULL DEFAULT '';
