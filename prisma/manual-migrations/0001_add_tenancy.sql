-- Multi-tenant foundation: expand + backfill + contract, atomic & idempotent.
-- Run ONCE against the database (after a Neon snapshot). Safe to re-run.
-- Identifier/index names follow Prisma conventions so a later `prisma db push`
-- reports no drift.

BEGIN;

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── New tenancy tables ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Agency" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Agency_slug_key" ON "Agency"("slug");

CREATE TABLE IF NOT EXISTS "Membership" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "agencyId"  TEXT NOT NULL,
  "role"      "MembershipRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_agencyId_key" ON "Membership"("userId", "agencyId");
CREATE INDEX IF NOT EXISTS "Membership_agencyId_idx" ON "Membership"("agencyId");
CREATE INDEX IF NOT EXISTS "Membership_userId_idx" ON "Membership"("userId");

CREATE TABLE IF NOT EXISTS "Invitation" (
  "id"          TEXT NOT NULL,
  "agencyId"    TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "role"        "MembershipRole" NOT NULL DEFAULT 'MEMBER',
  "tokenHash"   TEXT NOT NULL,
  "status"      "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "acceptedAt"  TIMESTAMP(3),
  "invitedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_agencyId_email_key" ON "Invitation"("agencyId", "email");
CREATE INDEX IF NOT EXISTS "Invitation_agencyId_idx" ON "Invitation"("agencyId");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation"("email");

-- ── Expand: add nullable columns ──────────────────────────────────────────────
ALTER TABLE "User"            ADD COLUMN IF NOT EXISTS "lastActiveAgencyId" TEXT;
ALTER TABLE "Client"          ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "GoogleConnection" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "MonthlyReport"   ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "GscDailyData"    ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "Ga4DailyData"    ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "ReportEmailLog"  ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "SyncJob"         ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "AgencySetting"   ADD COLUMN IF NOT EXISTS "agencyId" TEXT;

-- ── Backfill: create the default agency and assign all existing rows to it ─────
-- Default agency name reuses the existing global agencyName setting when present.
INSERT INTO "Agency" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT
  'default-agency',
  COALESCE(NULLIF((SELECT "value" FROM "AgencySetting" WHERE "key" = 'agencyName' LIMIT 1), ''), 'Default Agency'),
  'default',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
ON CONFLICT ("id") DO NOTHING;

-- Existing users become OWNER of the default agency.
INSERT INTO "Membership" ("id", "userId", "agencyId", "role", "createdAt")
SELECT 'mbr_' || "id", "id", 'default-agency', 'OWNER', CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("userId", "agencyId") DO NOTHING;

UPDATE "Client"           SET "agencyId" = 'default-agency' WHERE "agencyId" IS NULL;
UPDATE "MonthlyReport"    SET "agencyId" = 'default-agency' WHERE "agencyId" IS NULL;
UPDATE "GscDailyData"     SET "agencyId" = 'default-agency' WHERE "agencyId" IS NULL;
UPDATE "Ga4DailyData"     SET "agencyId" = 'default-agency' WHERE "agencyId" IS NULL;
UPDATE "ReportEmailLog"   SET "agencyId" = 'default-agency' WHERE "agencyId" IS NULL;
UPDATE "SyncJob"          SET "agencyId" = 'default-agency' WHERE "agencyId" IS NULL;
UPDATE "AgencySetting"    SET "agencyId" = 'default-agency' WHERE "agencyId" IS NULL;
-- GoogleConnection: at most one row today; attach it to the default agency.
UPDATE "GoogleConnection" SET "agencyId" = 'default-agency' WHERE "agencyId" IS NULL;

-- ── Pre-flight: abort if any tenant row is still unassigned ────────────────────
DO $$
DECLARE missing INT;
BEGIN
  SELECT
    (SELECT count(*) FROM "Client"          WHERE "agencyId" IS NULL) +
    (SELECT count(*) FROM "MonthlyReport"   WHERE "agencyId" IS NULL) +
    (SELECT count(*) FROM "GscDailyData"    WHERE "agencyId" IS NULL) +
    (SELECT count(*) FROM "Ga4DailyData"    WHERE "agencyId" IS NULL) +
    (SELECT count(*) FROM "ReportEmailLog"  WHERE "agencyId" IS NULL) +
    (SELECT count(*) FROM "SyncJob"         WHERE "agencyId" IS NULL) +
    (SELECT count(*) FROM "AgencySetting"   WHERE "agencyId" IS NULL) +
    (SELECT count(*) FROM "GoogleConnection" WHERE "agencyId" IS NULL)
  INTO missing;
  IF missing > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % rows still have NULL agencyId', missing;
  END IF;
END $$;

-- ── Contract: enforce NOT NULL + constraints + indexes ────────────────────────
ALTER TABLE "Client"           ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "GoogleConnection" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "MonthlyReport"    ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "GscDailyData"     ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "Ga4DailyData"     ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "ReportEmailLog"   ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "SyncJob"          ALTER COLUMN "agencyId" SET NOT NULL;

-- GoogleConnection: one connection per agency.
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleConnection_agencyId_key" ON "GoogleConnection"("agencyId");

-- AgencySetting: swap single-column PK ("key") for composite ("agencyId","key").
ALTER TABLE "AgencySetting" ALTER COLUMN "agencyId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "AgencySetting" DROP CONSTRAINT "AgencySetting_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgencySetting" ADD CONSTRAINT "AgencySetting_pkey" PRIMARY KEY ("agencyId", "key");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

-- Secondary indexes (agencyId paired with hot filter columns).
CREATE INDEX IF NOT EXISTS "Client_agencyId_idx"          ON "Client"("agencyId");
CREATE INDEX IF NOT EXISTS "Client_agencyId_status_idx"   ON "Client"("agencyId", "status");
CREATE INDEX IF NOT EXISTS "MonthlyReport_agencyId_status_idx" ON "MonthlyReport"("agencyId", "status");
CREATE INDEX IF NOT EXISTS "GscDailyData_agencyId_date_idx"    ON "GscDailyData"("agencyId", "date");
CREATE INDEX IF NOT EXISTS "Ga4DailyData_agencyId_date_idx"    ON "Ga4DailyData"("agencyId", "date");
CREATE INDEX IF NOT EXISTS "ReportEmailLog_agencyId_status_idx" ON "ReportEmailLog"("agencyId", "status");
CREATE INDEX IF NOT EXISTS "SyncJob_agencyId_status_idx"       ON "SyncJob"("agencyId", "status");

-- ── Foreign keys (added last, after data is consistent) ───────────────────────
DO $$ BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "GscDailyData" ADD CONSTRAINT "GscDailyData_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Ga4DailyData" ADD CONSTRAINT "Ga4DailyData_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ReportEmailLog" ADD CONSTRAINT "ReportEmailLog_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgencySetting" ADD CONSTRAINT "AgencySetting_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
