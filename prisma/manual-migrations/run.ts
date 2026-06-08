import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

/**
 * Apply a manual SQL migration as a single transaction.
 *
 *   npx tsx prisma/manual-migrations/run.ts 0001_add_tenancy.sql --confirm
 *
 * The --confirm flag is required as a safety gate. ALWAYS take a Neon
 * snapshot/branch before running against production data.
 */
async function main() {
  const file = process.argv[2];
  const confirmed = process.argv.includes("--confirm");
  if (!file) {
    console.error("Usage: tsx prisma/manual-migrations/run.ts <file.sql> --confirm");
    process.exit(1);
  }
  if (!confirmed) {
    console.error(
      `Refusing to run "${file}" without --confirm.\n` +
        "Take a Neon snapshot/branch first, then re-run with --confirm."
    );
    process.exit(1);
  }

  const sql = readFileSync(join(__dirname, file), "utf8");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log(`Applying ${file} ...`);
    // The .sql file manages its own BEGIN/COMMIT.
    await pool.query(sql);
    console.log("✔ Migration applied successfully.");
  } catch (err) {
    console.error("✖ Migration failed (transaction rolled back):");
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
