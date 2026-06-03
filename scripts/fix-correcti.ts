import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const c = await prisma.client.findFirst({ where: { domain: "correcti.co.il" } });
  if (!c) { console.log("not found"); return; }
  const updated = await prisma.client.update({
    where: { id: c.id },
    data: { contactEmail: "Hagay@correct-gifts.com", ccEmails: [] },
  });
  console.log("updated:", updated.name, updated.contactEmail);
}

main().catch(console.error).finally(() => prisma.$disconnect());
