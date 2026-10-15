-- Отписка от серии писем (lib/lifecycleEmails.ts, /api/email/unsubscribe).
-- Для чистой установки. В рабочую базу эту колонку дописывает сам бэкенд при
-- запуске (src/lib/ensureSchema.ts): деплой миграции не выполняет, см. DEPLOY.md.
ALTER TABLE "User" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
