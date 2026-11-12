-- Nashmi intelligent matching. Backup PostgreSQL before applying, AFTER 001.
-- Compatible with existing users/services/applications; no removal of historical data.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_profiles jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'available';
ALTER TABLE users ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 2;
ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS required_skills text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE services ADD COLUMN IF NOT EXISTS category_suggestion text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS skill_suggestions text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE services ADD COLUMN IF NOT EXISTS urgency_bonus integer NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS bonus_escrow_active boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS service_matches (
  id serial PRIMARY KEY,
  service_id integer NOT NULL REFERENCES services(id),
  user_id integer NOT NULL REFERENCES users(id),
  rank integer NOT NULL,
  score real NOT NULL,
  explanation text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT service_matches_unique UNIQUE(service_id,user_id)
);
CREATE INDEX IF NOT EXISTS service_matches_user_idx ON service_matches(user_id,service_id);
CREATE INDEX IF NOT EXISTS services_required_skills_idx ON services USING GIN(required_skills);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_capacity_safe') THEN
  ALTER TABLE users ADD CONSTRAINT users_capacity_safe CHECK (capacity BETWEEN 0 AND 10);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='services_urgency_bonus_safe') THEN
  ALTER TABLE services ADD CONSTRAINT services_urgency_bonus_safe CHECK (urgency_bonus IN (0,5,10));
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
  CREATE TYPE dispute_status AS ENUM ('open','refunded','released');
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS service_disputes (
 id serial PRIMARY KEY,
 service_id integer NOT NULL UNIQUE REFERENCES services(id),
 opened_by integer NOT NULL REFERENCES users(id),
 reason text NOT NULL,
 status dispute_status NOT NULL DEFAULT 'open',
 resolution_note text,
 resolved_by integer REFERENCES users(id),
 created_at timestamp NOT NULL DEFAULT now(),
 resolved_at timestamp
);
CREATE TABLE IF NOT EXISTS saved_searches (
 id serial PRIMARY KEY,
 user_id integer NOT NULL REFERENCES users(id),
 query text NOT NULL,
 category text NOT NULL DEFAULT '',
 created_at timestamp NOT NULL DEFAULT now(),
 CONSTRAINT saved_searches_unique UNIQUE(user_id,query,category)
);
CREATE INDEX IF NOT EXISTS saved_searches_category_idx ON saved_searches(category);
COMMIT;
