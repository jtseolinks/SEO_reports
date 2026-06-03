/**
 * Sync clients from CSV export:
 *  1. Delete clients NOT in the approved list
 *  2. Update brandNameHe / brandNameEn / excludeFromReports for each client
 *  3. Sync auto-brand keywords (groupName: "auto-brand")
 *
 * Run: npx tsx scripts/sync-clients-from-csv.ts
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// Normalize domain: strip www. prefix and lowercase
const norm = (d: string) => d.replace(/^www\./i, "").toLowerCase().trim();

// ── Approved clients from CSV ─────────────────────────────────────────────────
const CSV: {
  domain: string;
  brandNameHe: string;
  brandNameEn: string;
  excludeFromReports: boolean;
}[] = [
  { domain: "alternaclinic.net",        brandNameHe: "",                      brandNameEn: "",              excludeFromReports: false },
  { domain: "azr.co.il",                brandNameHe: "עזריאלנט",              brandNameEn: "",              excludeFromReports: false },
  { domain: "boriskaplan.com",           brandNameHe: "בוריס קפלן",           brandNameEn: "",              excludeFromReports: false },
  { domain: "cleaning.co.il",           brandNameHe: "מוריה",                 brandNameEn: "moria",         excludeFromReports: false },
  { domain: "correcti.co.il",           brandNameHe: "קורקטי",               brandNameEn: "correcti",      excludeFromReports: false },
  { domain: "cybexonline.co.il",         brandNameHe: "סייבקס",               brandNameEn: "CYBEX",         excludeFromReports: false },
  { domain: "danakanner.co.il",          brandNameHe: "דנה קנר",              brandNameEn: "dana kanner",   excludeFromReports: false },
  { domain: "dr-fischer.co.il",          brandNameHe: "דר פישר",              brandNameEn: "dr fisher",     excludeFromReports: false },
  { domain: "eventsonline.co.il",        brandNameHe: "איוונטס",              brandNameEn: "events",        excludeFromReports: false },
  { domain: "groupb.co.il",             brandNameHe: "ביחד פיננסים",          brandNameEn: "",              excludeFromReports: false },
  { domain: "heter-bniya.co.il",         brandNameHe: "מרכז היתרי בניה",      brandNameEn: "",              excludeFromReports: false },
  { domain: "holy-bagel.co.il",          brandNameHe: "הולי בייגל",           brandNameEn: "holy bagel",    excludeFromReports: false },
  { domain: "improvement-center.co.il",  brandNameHe: "המרכז לשיפור התפקוד", brandNameEn: "",              excludeFromReports: true  },
  { domain: "investeam.org",            brandNameHe: "אינבסטים",              brandNameEn: "investeam",     excludeFromReports: false },
  { domain: "ja-taabura.co.il",          brandNameHe: "אלבראנס",              brandNameEn: "ז'ורבסקי",      excludeFromReports: false },
  { domain: "keds.co.il",               brandNameHe: "קדס",                   brandNameEn: "keds",          excludeFromReports: false },
  { domain: "maatefet.co.il",           brandNameHe: "מעטפת",                brandNameEn: "maatefet",      excludeFromReports: false },
  { domain: "magnolia.co.il",           brandNameHe: "מגנוליה",               brandNameEn: "magnolia",      excludeFromReports: false },
  { domain: "maof-hr.co.il",            brandNameHe: "מעוף",                  brandNameEn: "maof",          excludeFromReports: false },
  { domain: "mindme.co.il",             brandNameHe: "מיינדמי",               brandNameEn: "mindme",        excludeFromReports: false },
  { domain: "naamanp.co.il",            brandNameHe: "נעמן",                  brandNameEn: "naaman",        excludeFromReports: false },
  { domain: "paola.co.il",              brandNameHe: "פאולה",                 brandNameEn: "paola",         excludeFromReports: false },
  { domain: "philipmartins.co.il",       brandNameHe: "פיליפ מרטינס",         brandNameEn: "philip martins",excludeFromReports: false },
  { domain: "rankey.co.il",             brandNameHe: "רנקי",                  brandNameEn: "rankey",        excludeFromReports: false },
  { domain: "soltam.co.il",             brandNameHe: "מעוף",                  brandNameEn: "maof",          excludeFromReports: false },
  { domain: "uranus-invest.co.il",       brandNameHe: "אורנוס",               brandNameEn: "uranus-invest", excludeFromReports: false },
  { domain: "vardinon.co.il",           brandNameHe: "ורדינון",               brandNameEn: "vardinon",      excludeFromReports: false },
  { domain: "znk.co.il",               brandNameHe: "זינוק",                 brandNameEn: "zinuk",         excludeFromReports: false },
];

const APPROVED = new Set(CSV.map(r => norm(r.domain)));

async function main() {
  // ── 1. Fetch all clients ───────────────────────────────────────────────────
  const all = await prisma.client.findMany({ select: { id: true, name: true, domain: true } });
  console.log(`Total clients in DB: ${all.length}\n`);

  // ── 2. Delete clients not in the approved list ────────────────────────────
  const toDelete = all.filter(c => !APPROVED.has(norm(c.domain)));
  if (toDelete.length > 0) {
    console.log(`Deleting ${toDelete.length} client(s) not in approved list:`);
    for (const c of toDelete) {
      await prisma.client.delete({ where: { id: c.id } });
      console.log(`  ✗ deleted: ${c.name} (${c.domain})`);
    }
  } else {
    console.log("No clients to delete.\n");
  }

  // ── 3. Update brand names + excludeFromReports + sync keywords ────────────
  console.log("\nUpdating brand names and exclusions:");
  let updated = 0;
  let notFound = 0;

  for (const row of CSV) {
    // Find client by normalized domain
    const client = all.find(c => norm(c.domain) === norm(row.domain));

    if (!client) {
      console.log(`  ? not found in DB: ${row.domain}`);
      notFound++;
      continue;
    }

    // Update client fields
    await prisma.client.update({
      where: { id: client.id },
      data: {
        brandNameHe:        row.brandNameHe || null,
        brandNameEn:        row.brandNameEn || null,
        excludeFromReports: row.excludeFromReports,
        // Also disable autoSend when excluded
        ...(row.excludeFromReports && { autoSend: false }),
      },
    });

    // Sync auto-brand keywords
    const autoTerms = [row.brandNameHe, row.brandNameEn]
      .filter(t => t && t.trim().length > 1)
      .map(t => t.trim());

    await prisma.$transaction(async tx => {
      await tx.clientKeyword.deleteMany({
        where: { clientId: client.id, isBrand: true, groupName: "auto-brand" },
      });
      if (autoTerms.length > 0) {
        await tx.clientKeyword.createMany({
          data: autoTerms.map(kw => ({
            clientId:  client.id,
            keyword:   kw,
            isBrand:   true,
            isActive:  true,
            groupName: "auto-brand",
          })),
          skipDuplicates: true,
        });
      }
    });

    const flag = row.excludeFromReports ? " [מוחרג]" : "";
    const brands = autoTerms.length ? ` → ${autoTerms.join(" | ")}` : "";
    console.log(`  ✓ ${client.name} (${client.domain})${flag}${brands}`);
    updated++;
  }

  console.log(`\n✅ Done. Updated: ${updated}  Not found: ${notFound}  Deleted: ${toDelete.length}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
