/**
 * Seed brand-keyword exclusions for all clients.
 *
 * For each client adds two terms (skips duplicates & blanks):
 *   1. The client's display name - covers Hebrew / mixed names
 *   2. The domain root  - covers English / Latin brand references
 *      e.g. "znk.co.il" → "znk"  |  "correct-gifts.com" → "correct gifts"
 *
 * matchType defaults to CONTAINS in the schema, so any query that
 * includes the term (case-insensitive, regex) will be excluded.
 *
 * Run: npx tsx scripts/seed-brand-keywords.ts
 * Safe to re-run - skips already-existing keywords via skipDuplicates.
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

/** "correct-gifts.com" → "correct gifts"  |  "znk.co.il" → "znk" */
function domainRoot(domain: string): string {
  return domain.split(".")[0].replace(/-/g, " ").trim();
}

/** Deduplicate by lowercased value */
function dedup(terms: string[]): string[] {
  const seen = new Set<string>();
  return terms.filter(t => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, domain: true },
  });

  console.log(`Found ${clients.length} clients\n`);

  let added = 0;
  let skipped = 0;

  for (const client of clients) {
    const root = domainRoot(client.domain);

    // Collect candidate terms - skip blanks and single-char tokens
    const candidates = dedup(
      [client.name, root].filter(t => t.length > 1)
    );

    if (candidates.length === 0) {
      console.log(`  [skip] ${client.name} - no usable terms`);
      skipped++;
      continue;
    }

    // Fetch existing brand keywords so we don't touch them
    const existing = await prisma.clientKeyword.findMany({
      where: { clientId: client.id, isBrand: true },
      select: { keyword: true },
    });
    const existingSet = new Set(existing.map(k => k.keyword.toLowerCase()));

    const toInsert = candidates.filter(t => !existingSet.has(t.toLowerCase()));

    if (toInsert.length === 0) {
      console.log(`  [skip] ${client.name} - brand keywords already set: ${candidates.join(", ")}`);
      skipped++;
      continue;
    }

    await prisma.clientKeyword.createMany({
      data: toInsert.map(kw => ({
        clientId: client.id,
        keyword:  kw,
        isBrand:  true,
        isActive: true,
        // matchType defaults to CONTAINS in the schema
      })),
      skipDuplicates: true,
    });

    console.log(`  [ok]   ${client.name} (${client.domain}) → added: ${toInsert.join(", ")}`);
    added++;
  }

  console.log(`\nDone. Updated: ${added}  Already set / skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
