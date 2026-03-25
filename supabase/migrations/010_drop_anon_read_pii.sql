-- 010_drop_anon_read_pii.sql
-- AUD-001: Remove anon SELECT policies that expose PII.
-- notification_channels contains email addresses, Telegram IDs, Discord IDs.
-- waitlist contains email addresses.
-- Both are now read only via service_role (server-side).

DROP POLICY IF EXISTS "anon_read_notification_channels" ON notification_channels;
DROP POLICY IF EXISTS "waitlist_read_anon" ON waitlist;
