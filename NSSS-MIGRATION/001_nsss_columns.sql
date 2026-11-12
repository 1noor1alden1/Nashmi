-- Apply once, after backup; additive/non-destructive, not applied by this package.
ALTER TABLE services ADD COLUMN IF NOT EXISTS original_title text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS original_description text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS canonical_concepts text;
