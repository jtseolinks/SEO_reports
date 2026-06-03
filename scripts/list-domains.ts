import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const clients = await prisma.client.findMany({
    select: { domain: true, name: true, contactEmail: true },
    orderBy: { name: "asc" },
  });
  clients.forEach(c => console.log(`${c.domain} | ${c.name} | ${c.contactEmail}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
