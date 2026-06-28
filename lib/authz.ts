import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MembershipRole, Prisma } from "@/lib/generated/prisma/client";

/** Thrown by the guards below; converted to a JSON response via `toResponse`. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export type AgencyContext = {
  userId: string;
  agencyId: string;
  role: MembershipRole;
  email: string;
};

/**
 * Require an authenticated user with an active agency. Returns the agency
 * context to scope every query by. Throws HttpError(401|403).
 */
export async function requireAgency(): Promise<AgencyContext> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new HttpError(401, "Unauthorized");
  const { agencyId, membershipRole } = session.user;
  if (!agencyId || !membershipRole) throw new HttpError(403, "No active workspace");
  return { userId: session.user.id, agencyId, role: membershipRole, email: session.user.email };
}

/**
 * Server-component variant: redirect to /login instead of throwing when there
 * is no authenticated user / active agency. Use in server-component pages.
 */
export async function requireAgencyPage(): Promise<AgencyContext> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.agencyId || !session.user.membershipRole) {
    redirect("/login");
  }
  return {
    userId: session.user.id,
    agencyId: session.user.agencyId,
    role: session.user.membershipRole,
    email: session.user.email,
  };
}

/** Like requireAgency, but also requires OWNER or ADMIN role. */
export async function requireAgencyAdmin(): Promise<AgencyContext> {
  const ctx = await requireAgency();
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new HttpError(403, "Admin role required");
  }
  return ctx;
}

/**
 * Like requireAgencyAdmin but restricted to OWNER only.
 * Use for destructive / privileged workspace operations:
 * promoting members to ADMIN, removing ADMINs, transferring ownership.
 */
export async function requireAgencyOwner(): Promise<AgencyContext> {
  const ctx = await requireAgency();
  if (ctx.role !== "OWNER") {
    throw new HttpError(403, "Workspace owner role required");
  }
  return ctx;
}

export type SuperAdminContext = { userId: string; email: string };

/**
 * Requires the isSuperAdmin flag - cross-agency platform admin.
 * Independent of agency membership; the user may have no active agency.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new HttpError(401, "Unauthorized");
  if (!session.user.isSuperAdmin) throw new HttpError(403, "Super-admin access required");
  return { userId: session.user.id, email: session.user.email };
}

/**
 * Load a client by id ONLY if it belongs to the given agency. Uses findFirst
 * (not findUnique) so agencyId can be part of the filter, and returns 404 - not
 * 403 - so a client's existence is never leaked across tenants.
 */
export async function requireClientInAgency<
  T extends Prisma.ClientInclude | undefined = undefined
>(
  id: string,
  agencyId: string,
  include?: T
): Promise<Prisma.ClientGetPayload<{ include: T }>> {
  const client = await prisma.client.findFirst({
    where: { id, agencyId },
    include: include as Prisma.ClientInclude | undefined,
  });
  if (!client) throw new HttpError(404, "Not found");
  return client as Prisma.ClientGetPayload<{ include: T }>;
}

/**
 * Uniform catch for route handlers: turns an HttpError into a JSON response,
 * rethrows anything unexpected (so it surfaces as a 500).
 *
 *   try { const ctx = await requireAgency(); ... }
 *   catch (e) { return toResponse(e); }
 */
export function toResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  throw e;
}
