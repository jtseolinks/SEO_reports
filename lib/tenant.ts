import { prisma } from "@/lib/prisma";

/**
 * Session-less agency enumeration for background jobs (e.g. the monthly cron),
 * which have no user session and must iterate tenants explicitly rather than
 * relying on any ambient agency context.
 */
export async function getAllAgencies() {
  return prisma.agency.findMany({ orderBy: { createdAt: "asc" } });
}
