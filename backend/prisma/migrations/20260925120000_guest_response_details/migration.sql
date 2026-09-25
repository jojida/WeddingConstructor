-- Анкета гостя: «Пока не знаю», дети отдельно и дополнительные вопросы.
-- Для чистой установки. В рабочую базу эти колонки дописывает сам бэкенд при
-- запуске (src/lib/ensureSchema.ts): деплой миграции не выполняет, см. DEPLOY.md.
ALTER TABLE "GuestResponse" ADD COLUMN "attendance" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GuestResponse" ADD COLUMN "childrenCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuestResponse" ADD COLUMN "answers" TEXT NOT NULL DEFAULT '[]';
