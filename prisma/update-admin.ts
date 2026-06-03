import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.NEW_ADMIN_EMAIL ?? "jtseolinks@gmail.com";
  const password = process.env.NEW_ADMIN_PASSWORD ?? "Momo2022!@#";
  const passwordHash = await hash(password, 12);
  const result = await prisma.user.updateMany({
    where: { role: "ADMIN" },
    data: { email, passwordHash },
  });
  console.log(`Updated ${result.count} admin user(s) → ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
