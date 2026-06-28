-- 0003_add_report_send_hour.sql
-- Adds a per-client send HOUR (0-23, Asia/Jerusalem) for the monthly auto-send,
-- complementing the existing reportSendDay. Defaults to 09:00 to match the
-- previous hard-coded behavior.
--
-- Run:  npx tsx prisma/manual-migrations/run.ts 0003_add_report_send_hour.sql --confirm
-- Shared Neon DB - run ONCE. Take a snapshot first.

BEGIN;

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "reportSendHour" INTEGER NOT NULL DEFAULT 9;

COMMIT;
