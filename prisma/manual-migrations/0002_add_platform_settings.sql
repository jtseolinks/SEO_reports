-- 0002_add_platform_settings.sql
-- Adds the platform-wide settings store and backfills the SMTP transport from the
-- most-recently-updated agency that had SMTP configured, so outgoing mail keeps
-- working immediately after the per-agency → platform SMTP migration.
--
-- Run:  npx tsx prisma/manual-migrations/run.ts 0002_add_platform_settings.sql --confirm
-- NOTE: local and server share the same Neon DB, so this runs ONCE for both.
--       Take a Neon snapshot/branch first.

BEGIN;

CREATE TABLE IF NOT EXISTS "PlatformSetting" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backfill the SMTP credentials from the latest agency that has them. smtpPass is
-- copied verbatim — it is encrypted with the shared key, and platform-settings.ts
-- decrypts it the same way agency-settings did.
WITH latest AS (
  SELECT s."agencyId"
  FROM "AgencySetting" s
  WHERE s."key" = 'smtpHost' AND s."value" <> ''
  ORDER BY s."updatedAt" DESC
  LIMIT 1
)
INSERT INTO "PlatformSetting" ("key", "value", "updatedAt")
SELECT s."key", s."value", CURRENT_TIMESTAMP
FROM "AgencySetting" s
JOIN latest l ON l."agencyId" = s."agencyId"
WHERE s."key" IN ('smtpHost', 'smtpPort', 'smtpUser', 'smtpPass')
  AND s."value" <> ''
ON CONFLICT ("key") DO NOTHING;

COMMIT;
