-- A personal exploration preference, not permission to edit the linked person.
ALTER TABLE "users" ADD COLUMN "linkedPersonId" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_linkedPersonId_fkey" FOREIGN KEY ("linkedPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
