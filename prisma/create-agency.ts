import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createAgencyWithOwner } from "./seed";

/**
 * Create an additional agency + OWNER for testing tenant isolation.
 *
 *   npx tsx prisma/create-agency.ts "Acme SEO" owner@acme.com "Passw0rd!"
 *
 * Args: <agencyName> <ownerEmail> <ownerPassword> [ownerName]
 */
async function main() {
  const [, , agencyName, ownerEmail, ownerPassword, ownerName] = process.argv;
  if (!agencyName || !ownerEmail || !ownerPassword) {
    console.error(
      'Usage: npx tsx prisma/create-agency.ts "<agencyName>" <ownerEmail> <ownerPassword> [ownerName]'
    );
    process.exit(1);
  }
  const { agency, user } = await createAgencyWithOwner({
    agencyName,
    ownerEmail,
    ownerPassword,
    ownerName,
  });
  console.log(`Created agency "${agency.name}" (slug=${agency.slug}, id=${agency.id})`);
  console.log(`Owner: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
