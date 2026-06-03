import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const r = await prisma.client.findFirst({
  where: { googleProperties: { ga4PropertyId: { not: '' } } },
  include: { googleProperties: true }
});
console.log(JSON.stringify({ id: r?.id, name: r?.name, ga4: r?.googleProperties?.ga4PropertyId }));
const count = await prisma.googleProperty.count({ where: { ga4PropertyId: { not: '' } } });
console.log('Total with GA4:', count);
await prisma.$disconnect();
