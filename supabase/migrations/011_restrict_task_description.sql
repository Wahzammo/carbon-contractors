-- 011_restrict_task_description.sql
-- AUD-009: Restrict task_description visibility.
-- task_description is free-text that may contain sensitive off-chain content
-- (locations, personal details, specific instructions). All other task fields
-- are either on-chain already or non-sensitive metadata.
--
-- Strategy:
--   1. Drop the blanket anon SELECT policy on tasks.
--   2. Create a tasks_public view that excludes task_description.
--   3. Grant anon SELECT on the view for transparent marketplace data.
--   4. Service_role continues to bypass RLS and sees everything.

-- ── Drop blanket anon read policy ───────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_read_anon" ON tasks;

-- ── Create public view without task_description ─────────────────────────────
CREATE OR REPLACE VIEW tasks_public AS
  SELECT
    id,
    payment_request_id,
    from_agent_wallet,
    to_human_wallet,
    amount_usdc,
    deadline_unix,
    status,
    tx_hash,
    escrow_contract,
    created_at,
    updated_at
  FROM tasks;

-- ── Grant anon access to the view ───────────────────────────────────────────
GRANT SELECT ON tasks_public TO anon;
