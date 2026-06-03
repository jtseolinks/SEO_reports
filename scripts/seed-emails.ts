/**
 * One-time script: match clients by domain and set contactEmail / ccEmails.
 * Run: npx tsx scripts/seed-emails.ts
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// Domain → emails mapping (jtseolinks@gmail.com entries excluded)
const MAP: Record<string, string[]> = {
  "bolparket.com":              ["bolparket@gmail.com"],
  "i-optic.co.il":              ["michal@i-optic.co.il"],
  "bagir-il.com":               ["Shirans@bagir-il.com", "webagir@bagir-il.com"],
  "zahavi-trading.com":         ["linory12@gmail.com"],
  "ja-taabura.co.il":           ["tomal.cmo@gmail.com"],
  "cleaning.co.il":             ["moran@moriyaltd.co.il"],
  "magnolia.co.il":             ["gili@magnolia.co.il"],
  "maof-hr.co.il":              ["hagars@maof-group.co.il", "noah@maof-group.co.il"],
  "klkl.co.il":                 ["zafrir@tz-7.com"],
  "azr.co.il":                  ["gilazr@gmail.com", "av@azr.co.il"],
  "vardinon.co.il":             ["lirond@extraretail.co.il", "gilger@extraretail.co.il"],
  "naamanp.co.il":              ["lirond@extraretail.co.il", "gilger@extraretail.co.il"],
  "eventsonline.co.il":         ["linor@rankey.co.il"],
  "reborn.co.il":               ["Office@reborn.co.il"],
  "caspi-law.com":              ["Lior@caspi-law.co.il", "Ron@caspi-law.co.il"],
  "octostyle.co.il":            ["ooctostyle@gmail.com", "rana@cks.co.il", "Suhad.Morya@gmail.com"],
  "rhr.co.il":                  ["vered@rhr.co.il", "ozshlomo82@gmail.com"],
  "soltam.co.il":               ["michald@soltam.co.il"],
  "holy-bagel.co.il":           ["ik@ykg.co.il"],
  "holy-bagel-pt.co.il":        ["lidor@rankey.co.il"],
  "holy-bagel-gabash.co.il":    ["lidor@rankey.co.il"],
  "holy-bagel-harish.co.il":    ["lidor@rankey.co.il"],
  "holy-bagel-hadera.co.il":    ["lidor@rankey.co.il"],
  "philipmartins.co.il":        ["ceo.greencosmetics@gmail.com"],
  "annabella-pump.co.il":       ["liorg@lgonline.co", "Sharon.dover@annabella-pump.com"],
  "boriskaplan.com":            ["office@boriskaplan.com"],
  "danakanner.co.il":           ["danakaner@gmail.com"],
  "efratilan.co.il":            ["efrat@efratilan.co.il"],
  "cybexonline.co.il":          ["yuval@nobinf.com", "arieldvora1@gmail.com"],
  "heter-bniya.co.il":          ["keren@hbn.co.il"],
  "petvet.org.il":              ["fabitrumper@gmail.com"],
  "mythologytitans.com":        ["ohadba07@gmail.com"],
  "alternaclinic.net":          ["alternaclinics@gmail.com"],
  "wivo.co.il":                 ["ran@wivo.co.il"],
  "improvement-center.co.il":   ["eyalkarp@gmail.com"],
  "rankey.co.il":               ["juliantrumper15@gmail.com"],
  "mindme.co.il":               ["lilach@mindme.co.il"],
  "sora.co.il":                 ["adirilan2@gmail.com"],
  "znk.co.il":                  ["yotam@znk.co.il"],
  "kamedis.co.il":              ["j.alejandro@kamedis.com"],
  "stock-home.co.il":           ["yehuda.moryos@gmail.com"],
  "yarel-eng.com":              ["Office@yarel-eng.com"],
  "groupb.co.il":               ["or@groupb.co.il"],
  "success-ronuziel.co.il":     ["ron.uziel1@gmail.com"],
  "dr-fischer.co.il":           ["Dana_M@dr-fischer.com"],
  "soundcenter.co.il":          ["Yuda8888@gmail.com"],
  "dresler.co.il":              ["Yuda8888@gmail.com"],
  "conversiongems.com":         ["galnetzer7@gmail.com"],
  "tue.co.il":                  ["touchup.tlv@gmail.com"],
  "kal.solutions":               ["info@kal.solutions"],
  "shop.yogev-heroes.co.il":    ["Ofer.yogev6@gmail.com", "Ayelet.ofer1@gmail.com"],
  "investeam.org":              ["yaniv@investeam.org", "yaron@investeam.org", "amit@investeam.org"],
  "brand-formance.com":         ["nadav@brand-formance.com", "tomer@brand-formance.com"],
  "honeybali.com":              ["infohoneybali@gmail.com", "oripeleg15@gmail.com", "sitbonyohai@gmail.com"],
  "uranus-invest.co.il":        ["tom@crms.co.il"],
  "cryptomaster.co.il":         ["tom@crms.co.il"],
  "correct-gifts.com":          ["Hagay@correct-gifts.com"],
  "byhd.co.il":                 ["or@groupb.co.il"],
  "louskyor.co.il":             ["or@groupb.co.il"],
  "casabella.co.il":            ["Urishmuel23@gmail.com"],
  "byhdg.co.il":                ["or@groupb.co.il"],
  "maatefet.co.il":             ["lidor@rankey.co.il"],
  "paola.co.il":                ["daniel@higs.co.il"],
  "maof-global.co.il":          ["noah@maof-group.co.il", "Hagars@maof-group.co.il", "moriahd@maof-group.co.il"],
  "ilayproductions.com":        ["maormbs4@gmail.com"],
  "seensme.com":                ["nir@seensme.com"],
  "uvsun.co.il":                ["Yossimzhp@gmail.com"],
  "keds.co.il":                 ["gil@magnum.org.il"],
};

function normalizeDomain(raw: string): string {
  return raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^sc-domain:/, "")
    .replace(/\/$/, "")
    .toLowerCase()
    .trim();
}

async function main() {
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, domain: true, contactEmail: true, ccEmails: true },
  });

  // Also fetch gscSiteUrl as fallback
  const props = await prisma.clientGoogleProperty.findMany({
    select: { clientId: true, gscSiteUrl: true },
  });
  const gscMap = new Map(props.map(p => [p.clientId, normalizeDomain(p.gscSiteUrl)]));

  let updated = 0;
  let notFound: string[] = [];

  for (const [rawDomain, emails] of Object.entries(MAP)) {
    const target = normalizeDomain(rawDomain);

    // Try to match by client.domain first, then gscSiteUrl
    let client = clients.find(c => normalizeDomain(c.domain) === target);
    if (!client) {
      const match = [...gscMap.entries()].find(([, d]) => d === target);
      if (match) client = clients.find(c => c.id === match[0]);
    }

    if (!client) {
      notFound.push(rawDomain);
      continue;
    }

    const [contactEmail, ...ccEmails] = emails;
    await prisma.client.update({
      where: { id: client.id },
      data: { contactEmail, ccEmails },
    });

    console.log(`✓ ${client.name} (${client.domain}) → ${contactEmail}${ccEmails.length ? ` + ${ccEmails.length} CC` : ""}`);
    updated++;
  }

  console.log(`\n✅ עודכנו ${updated} לקוחות`);
  if (notFound.length) {
    console.log(`\n⚠️  לא נמצאו תואמים ל-${notFound.length} דומיינים:`);
    notFound.forEach(d => console.log(`  - ${d}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
