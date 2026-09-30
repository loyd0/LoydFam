-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public" VERSION "1.6";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog" VERSION "1.0";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public" VERSION "1.1";

-- CreateEnum
CREATE TYPE "public"."ActivityType" AS ENUM ('IMPORT_RUN', 'NOTE_CREATED', 'MEDIA_ADDED', 'TAG_ADDED', 'ENTITY_UPDATED');

-- CreateEnum
CREATE TYPE "public"."EntityAttributeType" AS ENUM ('PERSON', 'RELATIONSHIP', 'EVENT', 'PLACE', 'MEDIA');

-- CreateEnum
CREATE TYPE "public"."EventType" AS ENUM ('BIRTH', 'DEATH', 'MARRIAGE', 'RESIDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."ImportEntityType" AS ENUM ('PERSON', 'EVENT', 'RELATIONSHIP', 'PLACE', 'MEDIA', 'TAG', 'NOTE', 'CONTACT');

-- CreateEnum
CREATE TYPE "public"."ImportIssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."ImportRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."MediaLinkEntity" AS ENUM ('PERSON', 'EVENT');

-- CreateEnum
CREATE TYPE "public"."MediaType" AS ENUM ('PHOTO', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."NoteEntityType" AS ENUM ('PERSON', 'EVENT', 'RELATIONSHIP', 'PLACE');

-- CreateEnum
CREATE TYPE "public"."ParentChildType" AS ENUM ('BIOLOGICAL', 'STEP', 'ADOPTIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."PartnershipType" AS ENUM ('MARRIAGE', 'PARTNER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."PlaceType" AS ENUM ('COUNTRY', 'REGION', 'CITY', 'ADDRESS', 'HOUSE', 'CEMETERY', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SavedViewScope" AS ENUM ('PEOPLE', 'STATS', 'TREE', 'TIMELINE');

-- CreateEnum
CREATE TYPE "public"."TagLinkEntity" AS ENUM ('PERSON', 'EVENT', 'RELATIONSHIP', 'MEDIA', 'NOTE');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'VIEWER');

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activities" (
    "id" TEXT NOT NULL,
    "type" "public"."ActivityType" NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contacts" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "emails" TEXT[],
    "mobile" TEXT,
    "landline" TEXT,
    "address2000" TEXT,
    "postalAddress2021" TEXT,
    "establishingContact" TEXT,
    "comments" TEXT,
    "ageCurrentExcel" INTEGER,
    "numberOfKids2000" INTEGER,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."entity_attributes" (
    "id" TEXT NOT NULL,
    "entityType" "public"."EntityAttributeType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueText" TEXT,
    "valueJson" JSONB,
    "sourceImportRowId" TEXT,

    CONSTRAINT "entity_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "type" "public"."EventType" NOT NULL,
    "title" TEXT,
    "descriptionMd" TEXT,
    "dateExact" DATE,
    "dateYear" INTEGER,
    "dateMonth" INTEGER,
    "dateDay" INTEGER,
    "dateText" TEXT,
    "dateIsApprox" BOOLEAN NOT NULL DEFAULT false,
    "placeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."import_entity_links" (
    "id" TEXT NOT NULL,
    "importRowId" TEXT NOT NULL,
    "entityType" "public"."ImportEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "import_entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."import_issues" (
    "id" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "severity" "public"."ImportIssueSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sheetName" TEXT,
    "rowIndex" INTEGER,
    "entityType" TEXT,
    "entityId" TEXT,
    "meta" JSONB,

    CONSTRAINT "import_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."import_rows" (
    "id" TEXT NOT NULL,
    "importSheetId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rowJson" JSONB NOT NULL,
    "rowHash" TEXT,
    "isBlank" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."import_runs" (
    "id" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "status" "public"."ImportRunStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,
    "appVersion" TEXT,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."import_sheets" (
    "id" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "import_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'VIEWER',
    "status" "public"."InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media" (
    "id" TEXT NOT NULL,
    "type" "public"."MediaType" NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "takenDateExact" DATE,
    "takenDateText" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_links" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "entityType" "public"."MediaLinkEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "media_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notes" (
    "id" TEXT NOT NULL,
    "entityType" "public"."NoteEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT,
    "markdown" TEXT NOT NULL,
    "tiptapJson" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."parent_child" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" "public"."ParentChildType" NOT NULL DEFAULT 'UNKNOWN',
    "notesMd" TEXT,

    CONSTRAINT "parent_child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."partnerships" (
    "id" TEXT NOT NULL,
    "personAId" TEXT NOT NULL,
    "personBId" TEXT NOT NULL,
    "type" "public"."PartnershipType" NOT NULL DEFAULT 'UNKNOWN',
    "startEventId" TEXT,
    "endEventId" TEXT,
    "notesMd" TEXT,

    CONSTRAINT "partnerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."people" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "primaryExternalKey" TEXT NOT NULL,
    "sourceSystem" TEXT,
    "externalId" TEXT,
    "branchRootExternalId" TEXT,
    "gender" "public"."Gender" NOT NULL DEFAULT 'UNKNOWN',
    "surname" TEXT,
    "givenName1" TEXT,
    "givenName2" TEXT,
    "givenName3" TEXT,
    "knownAs" TEXT,
    "birthName" TEXT,
    "preferredName" TEXT,
    "displayName" TEXT NOT NULL,
    "dspFlag" BOOLEAN,
    "residencyText" TEXT,
    "biographyMd" TEXT,
    "biographyShortMd" TEXT,
    "notesMd" TEXT,
    "expectedPhotoCount" INTEGER,
    "legacyGeneration" INTEGER,
    "generationFromWilliam" INTEGER,
    "descendantGeneration" TEXT,
    "lengthMetric" TEXT,
    "rawNameString" TEXT,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."person_aliases" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT,

    CONSTRAINT "person_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."person_events" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "person_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."person_places" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "fromEventId" TEXT,
    "toEventId" TEXT,
    "notesMd" TEXT,

    CONSTRAINT "person_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."places" (
    "id" TEXT NOT NULL,
    "type" "public"."PlaceType" NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "sourceText" TEXT,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "public"."SavedViewScope" NOT NULL,
    "filterJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."source_files" (
    "id" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blobUrl" TEXT,

    CONSTRAINT "source_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tag_links" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "entityType" "public"."TagLinkEntity" NOT NULL,
    "entityId" TEXT NOT NULL,

    CONSTRAINT "tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordHash" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "public"."accounts"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE INDEX "activities_createdAt_idx" ON "public"."activities"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_personId_key" ON "public"."contacts"("personId" ASC);

-- CreateIndex
CREATE INDEX "entity_attributes_entityType_entityId_idx" ON "public"."entity_attributes"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "invites_email_key" ON "public"."invites"("email" ASC);

-- CreateIndex
CREATE INDEX "notes_entityType_entityId_idx" ON "public"."notes"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "parent_child_parentId_childId_key" ON "public"."parent_child"("parentId" ASC, "childId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "partnerships_personAId_personBId_key" ON "public"."partnerships"("personAId" ASC, "personBId" ASC);

-- CreateIndex
CREATE INDEX "people_displayName_idx" ON "public"."people" USING GIN ("displayName" gin_trgm_ops ASC);

-- CreateIndex
CREATE INDEX "people_knownAs_idx" ON "public"."people" USING GIN ("knownAs" gin_trgm_ops ASC);

-- CreateIndex
CREATE UNIQUE INDEX "people_primaryExternalKey_key" ON "public"."people"("primaryExternalKey" ASC);

-- CreateIndex
CREATE INDEX "people_surname_idx" ON "public"."people" USING GIN ("surname" gin_trgm_ops ASC);

-- CreateIndex
CREATE UNIQUE INDEX "person_events_personId_eventId_role_key" ON "public"."person_events"("personId" ASC, "eventId" ASC, "role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "public"."sessions"("sessionToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "source_files_sha256_key" ON "public"."source_files"("sha256" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tag_links_tagId_entityType_entityId_key" ON "public"."tag_links"("tagId" ASC, "entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "public"."tags"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "public"."verification_tokens"("identifier" ASC, "token" ASC);

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "public"."places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_entity_links" ADD CONSTRAINT "import_entity_links_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "public"."import_rows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_issues" ADD CONSTRAINT "import_issues_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "public"."import_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_rows" ADD CONSTRAINT "import_rows_importSheetId_fkey" FOREIGN KEY ("importSheetId") REFERENCES "public"."import_sheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_runs" ADD CONSTRAINT "import_runs_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "public"."source_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_sheets" ADD CONSTRAINT "import_sheets_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "public"."import_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media" ADD CONSTRAINT "media_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_links" ADD CONSTRAINT "media_links_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_links" ADD CONSTRAINT "media_links_person_fk" FOREIGN KEY ("entityId") REFERENCES "public"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_person_fk" FOREIGN KEY ("entityId") REFERENCES "public"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."parent_child" ADD CONSTRAINT "parent_child_childId_fkey" FOREIGN KEY ("childId") REFERENCES "public"."people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."parent_child" ADD CONSTRAINT "parent_child_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partnerships" ADD CONSTRAINT "partnerships_endEventId_fkey" FOREIGN KEY ("endEventId") REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partnerships" ADD CONSTRAINT "partnerships_personAId_fkey" FOREIGN KEY ("personAId") REFERENCES "public"."people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partnerships" ADD CONSTRAINT "partnerships_personBId_fkey" FOREIGN KEY ("personBId") REFERENCES "public"."people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partnerships" ADD CONSTRAINT "partnerships_startEventId_fkey" FOREIGN KEY ("startEventId") REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."person_aliases" ADD CONSTRAINT "person_aliases_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."person_events" ADD CONSTRAINT "person_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."person_events" ADD CONSTRAINT "person_events_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."person_places" ADD CONSTRAINT "person_places_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."person_places" ADD CONSTRAINT "person_places_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "public"."places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_views" ADD CONSTRAINT "saved_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tag_links" ADD CONSTRAINT "tag_links_person_fk" FOREIGN KEY ("entityId") REFERENCES "public"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tag_links" ADD CONSTRAINT "tag_links_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

