-- Rename skills column to categories in the humans table.
-- The column type (TEXT[]) and GIN index semantics remain identical.
ALTER TABLE humans RENAME COLUMN skills TO categories;

DROP INDEX IF EXISTS idx_humans_skills;
CREATE INDEX IF NOT EXISTS idx_humans_categories ON humans USING GIN (categories);
