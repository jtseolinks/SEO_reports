import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Bulk-set each client's contactEmail from a domain -> email mapping.
 *
 *   npx tsx scripts/fill-client-emails.ts            # dry-run (no writes)
 *   npx tsx scripts/fill-client-emails.ts --apply    # write contactEmail
 *
 * Matching is by NORMALIZED domain (lowercase, strip protocol/www/path).
 * Policy: overwrite contactEmail always. ccEmails are left untouched.
 */

function normalizeDomain(d: string): string {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\/$/, "");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const raw = JSON.parse(readFileSync(join(__dirname, "client-emails.json"), "utf8")) as Record<string, string>;

  const wanted = new Map<string, string>();
  for (const [dom, email] of Object.entries(raw)) {
    if (!email?.trim()) continue;
    wanted.set(normalizeDomain(dom), email.trim());
  }

  const { prisma } = await import("../lib/prisma");
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, domain: true, contactEmail: true, agencyId: true },
  });

  const byDomain = new Map<string, typeof clients>();
  for (const c of clients) {
    const nd = normalizeDomain(c.domain);
    if (!byDomain.has(nd)) byDomain.set(nd, []);
    byDomain.get(nd)!.push(c);
  }

  const toUpdate: { id: string; name: string; domain: string; old: string; next: string }[] = [];
  const unmatched: string[] = [];

  for (const [nd, email] of wanted) {
    const matches = byDomain.get(nd) ?? [];
    if (matches.length === 0) { unmatched.push(nd); continue; }
    for (const c of matches) {
      toUpdate.push({ id: c.id, name: c.name, domain: c.domain, old: c.contactEmail ?? "", next: email });
    }
  }

  const mapped = new Set(wanted.keys());
  const noMapping = clients.filter((c) => !mapped.has(normalizeDomain(c.domain)));

  console.log(`\n=== ${apply ? "APPLY" : "DRY-RUN"} ===`);
  console.log(`DB clients: ${clients.length} | mapping entries: ${wanted.size}\n`);

  console.log(`Will set contactEmail on ${toUpdate.length} client(s):`);
  for (const u of toUpdate) {
    const change = u.old.toLowerCase() === u.next.toLowerCase() ? "(already set)" : `${u.old || "(empty)"}  ->  ${u.next}`;
    console.log(`  ${normalizeDomain(u.domain).padEnd(28)} [${u.name}]  ${change}`);
  }

  if (unmatched.length) {
    console.log(`\n⚠ Unmatched mapping domains (no client in DB): ${unmatched.length}`);
    unmatched.forEach((d) => console.log(`  ${d}`));
  }
  if (noMapping.length) {
    console.log(`\nℹ DB clients with NO mapping (left untouched): ${noMapping.length}`);
    noMapping.forEach((c) => console.log(`  ${normalizeDomain(c.domain).padEnd(28)} [${c.name}]  current: ${c.contactEmail || "(empty)"}`));
  }

  if (apply) {
    let n = 0;
    for (const u of toUpdate) {
      if (u.old.toLowerCase() === u.next.toLowerCase()) continue;
      await prisma.client.update({ where: { id: u.id }, data: { contactEmail: u.next } });
      n++;
    }
    console.log(`\n✔ Updated ${n} client(s).`);
  } else {
    console.log(`\n(dry-run - no writes. Re-run with --apply to commit.)`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
