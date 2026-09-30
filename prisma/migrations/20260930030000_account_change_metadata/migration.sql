-- Preserve account-change events without retaining credential or contact values.
CREATE OR REPLACE FUNCTION archive_capture_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  prior JSONB;
  next JSONB;
  record_id TEXT;
  sensitive_changes TEXT[] := ARRAY[]::TEXT[];
  field_name TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN prior := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN next := to_jsonb(NEW); END IF;
  -- Never duplicate credentials, invitation tokens or account contact details into history.
  IF TG_TABLE_NAME = 'users' THEN
    FOREACH field_name IN ARRAY ARRAY['passwordHash','email','emailVerified','image'] LOOP
      IF (prior->field_name) IS DISTINCT FROM (next->field_name) THEN sensitive_changes := array_append(sensitive_changes, field_name); END IF;
    END LOOP;
    prior := prior - ARRAY['passwordHash','email','emailVerified','image'];
    next := next - ARRAY['passwordHash','email','emailVerified','image'];
    -- Record which protected account fields changed, never their values.
    IF next IS NOT NULL AND cardinality(sensitive_changes) > 0 THEN next := next || jsonb_build_object('protectedFieldsChanged', to_jsonb(sensitive_changes)); END IF;
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

