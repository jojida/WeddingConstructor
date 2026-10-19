-- Напоминание гостям, не ответившим на анкету (lib/reminders.ts): телефон, который пара
-- вписала гостю, и флажок в настройках. Для чистой установки. В рабочую базу колонки
-- дописывает сам бэкенд при запуске (src/lib/ensureSchema.ts): деплой миграции не выполняет.
ALTER TABLE "GuestReminder" ADD COLUMN "guestId" TEXT;
ALTER TABLE "ReminderSettings" ADD COLUMN "noReply" BOOLEAN NOT NULL DEFAULT false;
