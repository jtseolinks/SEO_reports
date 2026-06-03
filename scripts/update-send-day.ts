import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
async function main() {
  const r = await prisma.client.updateMany({ data: { reportSendDay: 1 } });
  console.log("Updated:", r.count, "clients to reportSendDay=1");
  await prisma.$disconnect();
}
main().catch(console.error);
