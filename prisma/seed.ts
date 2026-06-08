import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "agency"
  );
}

/** Create (or fetch) an agency and an OWNER user for it. Idempotent. */
export async function createAgencyWithOwner(opts: {
  agencyName: string;
  slug?: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerName?: string;
}) {
  const slug = opts.slug ?? slugify(opts.agencyName);
  const agency = await prisma.agency.upsert({
    where: { slug },
    create: { name: opts.agencyName, slug },
    update: { name: opts.agencyName },
  });

  let user = await prisma.user.findUnique({ where: { email: opts.ownerEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: opts.ownerEmail,
        name: opts.ownerName ?? "Owner",
        passwordHash: await hash(opts.ownerPassword, 12),
        role: "ADMIN",
      },
    });
  }

  await prisma.membership.upsert({
    where: { userId_agencyId: { userId: user.id, agencyId: agency.id } },
    create: { userId: user.id, agencyId: agency.id, role: "OWNER" },
    update: { role: "OWNER" },
  });

  return { agency, user };
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "changeme123";
  const agencyName = process.env.AGENCY_NAME ?? "Default Agency";

  // Ensure the default agency exists (slug "default" matches the backfill migration).
  const agency = await prisma.agency.upsert({
    where: { slug: "default" },
    create: { name: agencyName, slug: "default" },
    update: {},
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Make sure the existing admin owns the default agency.
    await prisma.membership.upsert({
      where: { userId_agencyId: { userId: existing.id, agencyId: agency.id } },
      create: { userId: existing.id, agencyId: agency.id, role: "OWNER" },
      update: {},
    });
    console.log(`Admin user already exists: ${email} (ensured OWNER of "${agency.name}")`);
    return;
  }

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name: "Admin", passwordHash, role: "ADMIN" },
  });
  await prisma.membership.create({
    data: { userId: user.id, agencyId: agency.id, role: "OWNER" },
  });

  console.log(`Created admin user: ${user.email} (OWNER of "${agency.name}")`);
  console.log(`Password: ${password}`);
  console.log("Change this password after first login.");
}

// Only run the bootstrap when executed directly (not when imported as a helper).
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
