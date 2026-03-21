-- 007_mcp_challenges.sql
-- NOR-178: Challenge-response authentication for MCP sessions.
-- Stores single-use challenges that agents must sign to prove wallet ownership.

CREATE TABLE IF NOT EXISTS mcp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  nonce text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_mcp_challenges_wallet_expires ON mcp_challenges (wallet_address, expires_at);

-- RLS: no public access. Only service_role writes/reads challenges.
ALTER TABLE mcp_challenges ENABLE ROW LEVEL SECURITY;
