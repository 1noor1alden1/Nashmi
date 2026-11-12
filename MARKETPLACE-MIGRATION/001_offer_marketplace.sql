-- Take a PostgreSQL backup first. Apply once on the Nashmi database.
ALTER TABLE services ADD COLUMN IF NOT EXISTS offers_deadline TIMESTAMP;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS proposed_points INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS promised_delivery TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_proposed_points_positive') THEN
    ALTER TABLE applications ADD CONSTRAINT applications_proposed_points_positive CHECK (proposed_points IS NULL OR proposed_points > 0);
  END IF;
END $$;
-- Legacy records are preserved. New requests use points_price=0 until acceptance.
