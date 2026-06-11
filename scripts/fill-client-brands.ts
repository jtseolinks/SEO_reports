import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Bulk-set each client's brandNameHe / brandNameEn from a domain -> {he,en}
 * mapping, AND sync the auto-brand keywords exactly like the settings UI does
 * (so branded queries are excluded from reports).
 *
 *   npx tsx scripts/fill-client-brands.ts           # dry-run (no writes)
 *   npx tsx scripts/fill-client-brands.ts --apply   # write + sync keywords
 *
 * Matching is by NORMALIZED domain. Empty he/en are stored as null.
 */

function normalizeDomain(d: string): string {
  return d.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\/$/, "");
}

type Brand = { he?: string; en?: string };

async function main() {
  const apply = process.argv.includes("--apply");
  const raw = JSON.parse(readFileSync(join(__dirname, "client-brands.json"), "utf8")) as Record<string, Brand>;

  const wanted = new Map<string, Brand>();
  for (const [dom, b] of Object.entries(raw)) {
    wanted.set(normalizeDomain(dom), { he: (b.he ?? "").trim(), en: (b.en ?? "").trim() });
  }

  const { prisma } = await import("../lib/prisma");
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, domain: true, brandNameHe: true, brandNameEn: true },
  });

  const byDomain = new Map<string, typeof clients>();
  for (const c of clients) {
    const nd = normalizeDomain(c.domain);
    if (!byDomain.has(nd)) byDomain.set(nd, []);
    byDomain.get(nd)!.push(c);
  }

  const planned: { id: string; name: string; domain: string; he: string; en: string }[] = [];
  const unmatched: string[] = [];

  for (const [nd, b] of wanted) {
    const matches = byDomain.get(nd) ?? [];
    if (matches.length === 0) { unmatched.push(nd); continue; }
    for (const c of matches) {
      planned.push({ id: c.id, name: c.name, domain: nd, he: b.he ?? "", en: b.en ?? "" });
    }
  }

  console.log(`\n=== ${apply ? "APPLY" : "DRY-RUN"} ===`);
  console.log(`DB clients: ${clients.length} | mapping entries: ${wanted.size}\n`);
  console.log(`Will set brand names on ${planned.length} client(s):`);
  for (const p of planned) {
    const terms = [p.he, p.en].filter((t) => t.length > 0);
    console.log(`  ${p.domain.padEnd(28)} [${p.name}]  he:"${p.he}" en:"${p.en}"  -> ${terms.length} brand keyword(s)`);
  }
  if (unmatched.length) {
    console.log(`\n⚠ Unmatched mapping domains (no client): ${unmatched.length}`);
    unmatched.forEach((d) => console.log(`  ${d}`));
  }

  if (apply) {
    let n = 0;
    for (const p of planned) {
      await prisma.$transaction(async (tx) => {
        await tx.client.update({
          where: { id: p.id },
          data: { brandNameHe: p.he || null, brandNameEn: p.en || null },
        });
        // Re-sync auto-brand keywords (mirror of app/api/clients/[id] PUT).
        await tx.clientKeyword.deleteMany({
          where: { clientId: p.id, isBrand: true, groupName: "auto-brand" },
        });
        const terms = [p.he, p.en].filter((t) => t.length > 0);
        if (terms.length > 0) {
          await tx.clientKeyword.createMany({
            data: terms.map((kw) => ({
              clientId: p.id, keyword: kw, isBrand: true, isActive: true, groupName: "auto-brand",
            })),
            skipDuplicates: true,
          });
        }
      });
      n++;
    }
    console.log(`\n✔ Updated ${n} client(s) + synced auto-brand keywords.`);
  } else {
    console.log(`\n(dry-run — no writes. Re-run with --apply to commit.)`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
