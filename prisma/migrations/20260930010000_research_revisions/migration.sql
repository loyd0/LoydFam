CREATE TABLE "property_articles" (
  "slug" TEXT PRIMARY KEY,
  "content" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "record_revisions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "actorUserId" TEXT,
  "actorLabel" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "record_revisions_entityType_entityId_createdAt_idx" ON "record_revisions"("entityType", "entityId", "createdAt" DESC);
CREATE INDEX "record_revisions_createdAt_idx" ON "record_revisions"("createdAt" DESC);

CREATE FUNCTION archive_capture_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  prior JSONB;
  next JSONB;
  record_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN prior := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN next := to_jsonb(NEW); END IF;
  -- Never duplicate credentials, invitation tokens or account contact details into history.
  IF TG_TABLE_NAME = 'users' THEN
    prior := prior - ARRAY['passwordHash','email','emailVerified','image'];
    next := next - ARRAY['passwordHash','email','emailVerified','image'];
  END IF;
  IF TG_OP = 'UPDATE' AND (prior - 'updatedAt') IS NOT DISTINCT FROM (next - 'updatedAt') THEN RETURN NEW; END IF;
  record_id := COALESCE(next->>'slug', prior->>'slug', next->>'id', prior->>'id');
  INSERT INTO record_revisions ("entityType", "entityId", operation, before, after, "actorUserId", "actorLabel", reason)
  VALUES (TG_ARGV[0], record_id, TG_OP, prior, next,
    NULLIF(current_setting('archive.actor_id', true), ''),
    COALESCE(NULLIF(current_setting('archive.actor_label', true), ''), 'Unattributed database change'),
    NULLIF(current_setting('archive.reason', true), ''));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION archive_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Revision history is append-only'; END $$;
CREATE TRIGGER record_revisions_immutable BEFORE UPDATE OR DELETE ON record_revisions FOR EACH ROW EXECUTE FUNCTION archive_revision_immutable();
CREATE TRIGGER property_articles_revision AFTER INSERT OR UPDATE OR DELETE ON "property_articles" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('property');
CREATE TRIGGER people_revision AFTER INSERT OR UPDATE OR DELETE ON "people" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('person');
CREATE TRIGGER person_aliases_revision AFTER INSERT OR UPDATE OR DELETE ON "person_aliases" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('alias');
CREATE TRIGGER entity_attributes_revision AFTER INSERT OR UPDATE OR DELETE ON "entity_attributes" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('attribute');
CREATE TRIGGER events_revision AFTER INSERT OR UPDATE OR DELETE ON "events" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('event');
CREATE TRIGGER person_events_revision AFTER INSERT OR UPDATE OR DELETE ON "person_events" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('person_event');
CREATE TRIGGER parent_child_revision AFTER INSERT OR UPDATE OR DELETE ON "parent_child" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('parent_child');
CREATE TRIGGER partnerships_revision AFTER INSERT OR UPDATE OR DELETE ON "partnerships" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('partnership');
CREATE TRIGGER media_revision AFTER INSERT OR UPDATE OR DELETE ON "media" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('media');
CREATE TRIGGER media_links_revision AFTER INSERT OR UPDATE OR DELETE ON "media_links" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('media_link');
CREATE TRIGGER notes_revision AFTER INSERT OR UPDATE OR DELETE ON "notes" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('note');
CREATE TRIGGER tags_revision AFTER INSERT OR UPDATE OR DELETE ON "tags" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('tag');
CREATE TRIGGER tag_links_revision AFTER INSERT OR UPDATE OR DELETE ON "tag_links" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('tag_link');
CREATE TRIGGER places_revision AFTER INSERT OR UPDATE OR DELETE ON "places" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('place');
CREATE TRIGGER person_places_revision AFTER INSERT OR UPDATE OR DELETE ON "person_places" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('person_place');
CREATE TRIGGER contacts_revision AFTER INSERT OR UPDATE OR DELETE ON "contacts" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('contact');
CREATE TRIGGER saved_views_revision AFTER INSERT OR UPDATE OR DELETE ON "saved_views" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('saved_view');
CREATE TRIGGER users_revision AFTER INSERT OR UPDATE OR DELETE ON "users" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('user');
CREATE TRIGGER source_files_revision AFTER INSERT OR UPDATE OR DELETE ON "source_files" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('source_file');
CREATE TRIGGER import_runs_revision AFTER INSERT OR UPDATE OR DELETE ON "import_runs" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('import_run');
CREATE TRIGGER import_issues_revision AFTER INSERT OR UPDATE OR DELETE ON "import_issues" FOR EACH ROW EXECUTE FUNCTION archive_capture_revision('import_issue');
