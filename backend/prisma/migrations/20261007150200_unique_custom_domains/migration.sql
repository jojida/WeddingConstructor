CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_customDomain_verified_key" ON "Invitation"("customDomain") WHERE "customDomain" <> '' AND "customDomainVerifiedAt" IS NOT NULL;
