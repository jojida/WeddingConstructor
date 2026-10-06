-- Планировщик: рассадка и меню (Person, SeatTable, MenuOption, PlannerSettings, PlannerNotice).
-- Только новые таблицы, существующие не меняются. Текст — вывод prisma migrate diff,
-- к которому добавлено IF NOT EXISTS: в рабочую базу эти же операторы выполняет сам бэкенд
-- при запуске (src/lib/ensureSchema.ts), деплой миграции не запускает, см. DEPLOY.md.

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlannerSettings" (
    "invitationId" TEXT NOT NULL PRIMARY KEY,
    "askMenu" BOOLEAN NOT NULL DEFAULT false,
    "askDiet" BOOLEAN NOT NULL DEFAULT false,
    "showMenu" BOOLEAN NOT NULL DEFAULT false,
    "showTable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlannerSettings_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MenuOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MenuOption_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SeatTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "shape" TEXT NOT NULL DEFAULT 'round',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeatTable_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationId" TEXT NOT NULL,
    "guestId" TEXT,
    "responseId" TEXT,
    "slot" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL DEFAULT '',
    "isChild" BOOLEAN NOT NULL DEFAULT false,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "menuOptionId" TEXT,
    "menuReview" BOOLEAN NOT NULL DEFAULT false,
    "diet" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL DEFAULT '',
    "tableId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Person_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Person_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Person_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "GuestResponse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Person_menuOptionId_fkey" FOREIGN KEY ("menuOptionId") REFERENCES "MenuOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Person_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "SeatTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlannerNotice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "seenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannerNotice_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MenuOption_invitationId_idx" ON "MenuOption"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SeatTable_invitationId_name_key" ON "SeatTable"("invitationId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Person_invitationId_idx" ON "Person"("invitationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Person_tableId_idx" ON "Person"("tableId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Person_menuOptionId_idx" ON "Person"("menuOptionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Person_guestId_slot_key" ON "Person"("guestId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Person_responseId_slot_key" ON "Person"("responseId", "slot");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlannerNotice_invitationId_seenAt_idx" ON "PlannerNotice"("invitationId", "seenAt");

