-- Prevent two media records from owning the same private blob.
CREATE UNIQUE INDEX "media_blobKey_key" ON "public"."media"("blobKey");
