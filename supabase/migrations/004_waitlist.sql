-- 004_waitlist.sql
-- Email waitlist for coming-soon landing page.

CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  source     TEXT DEFAULT 'landing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anon can read (not strictly needed, but consistent with other tables)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_read_anon" ON waitlist
  FOR SELECT TO anon USING (true);

-- Index for duplicate-check lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist (email);
