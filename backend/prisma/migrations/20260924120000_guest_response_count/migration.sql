-- Сколько человек придёт по ответу анкеты (гость и те, кто с ним).
-- Для чистой установки. В рабочую базу эту колонку дописывает сам бэкенд при
-- запуске (src/lib/ensureSchema.ts): деплой миграции не выполняет, см. DEPLOY.md.
ALTER TABLE "GuestResponse" ADD COLUMN "guestsCount" INTEGER NOT NULL DEFAULT 1;
