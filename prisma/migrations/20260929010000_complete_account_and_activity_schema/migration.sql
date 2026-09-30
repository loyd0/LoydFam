-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'NOTE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'NOTE_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'MEDIA_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'ENTITY_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'ENTITY_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'RELATIONSHIP_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'RELATIONSHIP_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'EVENT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'EVENT_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'EVENT_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'INVITE_SENT';
ALTER TYPE "ActivityType" ADD VALUE 'USER_JOINED';

-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT,
ADD COLUMN     "token" TEXT;

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_token_idx" ON "password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

