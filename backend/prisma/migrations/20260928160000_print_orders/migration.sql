CREATE TABLE IF NOT EXISTS "PrintOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "paymentId" TEXT NOT NULL DEFAULT '',
  "paymentKey" TEXT NOT NULL,
  "paidAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PrintOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PrintOrder_userId_idx" ON "PrintOrder"("userId");
