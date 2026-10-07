CREATE TABLE IF NOT EXISTS "PaymentAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invitationId" TEXT,
  "printOrderId" TEXT,
  "paymentId" TEXT NOT NULL DEFAULT '',
  "plan" TEXT NOT NULL DEFAULT '',
  "amountKopecks" INTEGER NOT NULL,
  "payload" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAttempt_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymentAttempt_printOrderId_fkey" FOREIGN KEY ("printOrderId") REFERENCES "PrintOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAttempt_invitationId_key" ON "PaymentAttempt"("invitationId");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAttempt_printOrderId_key" ON "PaymentAttempt"("printOrderId");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_paymentId_idx" ON "PaymentAttempt"("paymentId");
