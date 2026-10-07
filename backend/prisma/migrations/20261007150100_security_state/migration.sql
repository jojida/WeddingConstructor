ALTER TABLE "Invitation" ADD COLUMN "customDomainVerifiedAt" DATETIME;
ALTER TABLE "Invitation" ADD COLUMN "telegramConnectExpiresAt" DATETIME;
ALTER TABLE "VerificationCode" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
