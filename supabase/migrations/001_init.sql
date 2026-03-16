-- Carbon Contractors: Initial schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

CREATE TABLE IF NOT EXISTS humans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet TEXT NOT NULL UNIQUE,
  skills TEXT[] NOT NULL,
  rate_usdc NUMERIC(10,2) NOT NULL,
  availability TEXT NOT NULL DEFAULT 'offline'
    CHECK (availability IN ('available', 'busy', 'offline')),
  reputation_score INTEGER NOT NULL DEFAULT 0
    CHECK (reputation_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_humans_skills ON humans USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_humans_wallet ON humans (wallet);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_request_id TEXT NOT NULL UNIQUE,
  from_agent_wallet TEXT NOT NULL,
  to_human_wallet TEXT NOT NULL,
  task_description TEXT NOT NULL,
  amount_usdc NUMERIC(10,2) NOT NULL,
  deadline_unix BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'disputed', 'expired')),
  tx_hash TEXT,
  escrow_contract TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_human ON tasks (to_human_wallet);

-- Enable Row Level Security (permissive for now, tighten in Phase 6)
ALTER TABLE humans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Allow anon read access to humans (public directory)
CREATE POLICY "humans_read_all" ON humans
  FOR SELECT TO anon USING (true);

-- Allow anon insert/update on humans (registration — tighten with auth later)
CREATE POLICY "humans_write_anon" ON humans
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon full access to tasks (MCP server operates as anon for now)
CREATE POLICY "tasks_all_anon" ON tasks
  FOR ALL TO anon USING (true) WITH CHECK (true);
