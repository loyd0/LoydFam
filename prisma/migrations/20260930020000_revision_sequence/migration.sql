-- A transaction can create multiple versions with identical timestamps.
-- Order changes by their insertion sequence rather than random UUIDs.
ALTER TABLE record_revisions ADD COLUMN sequence BIGSERIAL NOT NULL;
CREATE UNIQUE INDEX record_revisions_sequence_key ON record_revisions(sequence);
