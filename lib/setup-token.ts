import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/** Create a 7-day setup token for a user+agency pair.
 *  Set isAgencySetup=true only when creating a brand-new agency (founding owner). */
export async function createSetupToken(
  userId: string,
  agencyId: string,
  opts: { isAgencySetup?: boolean } = {}
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  await prisma.setupToken.create({
    data: {
      tokenHash,
      userId,
      agencyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isAgencySetup: opts.isAgencySetup ?? false,
    },
  });
  return raw;
}

export type SetupTokenData = {
  id: string;
  userId: string;
  agencyId: string;
  agencyName: string;
  email: string;
  name: string | null;
  hasPassword: boolean;
  expired: boolean;
  used: boolean;
  /** True only for the founding owner of a new agency - shows full 5-step wizard */
  isAgencySetup: boolean;
  membershipRole: string;
};

/** Validate a raw token. Returns null if not found. */
export async function getSetupToken(raw: string): Promise<SetupTokenData | null> {
  const tokenHash = hashToken(raw);
  const record = await prisma.setupToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true, email: true, name: true, passwordHash: true,
          memberships: { where: {}, select: { agencyId: true, role: true } },
        },
      },
      agency: { select: { name: true } },
    },
  });
  if (!record) return null;
  const membership = record.user.memberships.find(m => m.agencyId === record.agencyId);
  return {
    id: record.id,
    userId: record.userId,
    agencyId: record.agencyId,
    agencyName: record.agency.name,
    email: record.user.email,
    name: record.user.name,
    hasPassword: !!record.user.passwordHash,
    expired: record.expiresAt < new Date(),
    used: !!record.usedAt,
    isAgencySetup: record.isAgencySetup,
    membershipRole: membership?.role ?? "MEMBER",
  };
}

/** Mark token as used (idempotent). */
export async function consumeSetupToken(id: string) {
  await prisma.setupToken.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}
