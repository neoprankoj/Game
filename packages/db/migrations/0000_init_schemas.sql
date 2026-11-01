-- 0000 init schemas (Part 2.3). Infrastructure only, no gameplay tables (DATABASE_DESIGN §2, §6).
-- Migration policy: forward-only; a short lock timeout so a migration never blocks the live game for long.
SET LOCAL lock_timeout = '3s';
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS game;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS platform;
--> statement-breakpoint
-- Append-only guard used by resource_ledger, battles and audit_log (DATABASE_DESIGN §2, verified in Part 1.3).
CREATE OR REPLACE FUNCTION platform.forbid_update_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'table %.% is append-only', TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = '42501';
END $$;
