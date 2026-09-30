CREATE TYPE "AmendmentTargetType" AS ENUM ('PERSON', 'PROPERTY');
CREATE TYPE "AmendmentStatus" AS ENUM ('PENDING', 'APPROVED', 'APPLIED_MANUALLY', 'REJECTED');
ALTER TABLE "users" ADD COLUMN "verifiedPersonId" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_verifiedPersonId_fkey" FOREIGN KEY ("verifiedPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "amendments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "targetType" "AmendmentTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "baseVersion" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "note" TEXT,
  "status" "AmendmentStatus" NOT NULL DEFAULT 'PENDING',
  "proposedByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3)
);
CREATE INDEX "amendments_status_createdAt_idx" ON "amendments"("status", "createdAt" DESC);
CREATE INDEX "amendments_proposedByUserId_createdAt_idx" ON "amendments"("proposedByUserId", "createdAt" DESC);
CREATE TRIGGER amendments_revision AFTER INSERT OR UPDATE OR DELETE ON "amendments" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('amendment');
