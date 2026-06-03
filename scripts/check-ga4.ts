import { prisma } from "../lib/prisma";

async function main() {
  const sample = await prisma.client.findMany({
    where: { googleProperties: { ga4PropertyId: { not: "" } } },
    include: { googleProperties: true },
    take: 3,
  });
  console.log("Clients with GA4:", sample.length);
  for (const c of sample) {
    console.log(`${c.id} | ${c.name} | ga4=${c.googleProperties?.ga4PropertyId}`);
  }
}
main().finally(() => prisma.$disconnect());
