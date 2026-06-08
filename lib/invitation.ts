import { randomBytes, createHash } from "crypto";
import { prisma } from "./prisma";
import type { MembershipRole } from "./generated/prisma/client";

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInvitation(
  agencyId: string,
  invitedById: string,
  email: string,
  role: MembershipRole = "MEMBER"
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + EXPIRY_MS);

  await prisma.invitation.upsert({
    where: { agencyId_email: { agencyId, email } },
    create: { agencyId, email, role, tokenHash, expiresAt, invitedById, status: "PENDING" },
    update: { role, tokenHash, expiresAt, invitedById, status: "PENDING" },
  });

  return token;
}

export async function getInvitationByTokenHash(tokenHash: string) {
  return prisma.invitation.findUnique({
    where: { tokenHash },
    include: { agency: { select: { name: true } } },
  });
}

export async function acceptInvitation(
  token: string,
  userData: { name: string; password: string } | null
): Promise<{ email: string; agencyId: string }> {
  const tokenHash = hashInviteToken(token);
  const invite = await prisma.invitation.findUnique({ where: { tokenHash } });

  if (!invite) throw new Error("קישור הזמנה לא תקין");
  if (invite.status === "ACCEPTED") throw new Error("הזמנה זו כבר אושרה");
  if (invite.status === "REVOKED") throw new Error("הזמנה זו בוטלה");
  if (invite.status !== "PENDING") throw new Error("ההזמנה אינה בתוקף");
  if (invite.expiresAt < new Date()) throw new Error("תוקף ההזמנה פג. בקש הזמנה חדשה.");

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  let userId: string;

  if (existing) {
    userId = existing.id;
  } else {
    if (!userData?.name || !userData?.password) throw new Error("שם וסיסמה נדרשים");
    if (userData.password.length < 8) throw new Error("הסיסמה חייבת להכיל לפחות 8 תווים");
    const { hash } = await import("bcryptjs");
    const hashed = await hash(userData.password, 12);
    const user = await prisma.user.create({
      data: { email: invite.email, name: userData.name, passwordHash: hashed, role: "ADMIN" },
    });
    userId = user.id;
  }

  await prisma.membership.upsert({
    where: { userId_agencyId: { userId, agencyId: invite.agencyId } },
    create: { userId, agencyId: invite.agencyId, role: invite.role },
    update: { role: invite.role },
  });

  await prisma.invitation.update({
    where: { tokenHash },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  return { email: invite.email, agencyId: invite.agencyId };
}

export async function revokeInvitation(id: string, agencyId: string): Promise<void> {
  await prisma.invitation.updateMany({
    where: { id, agencyId },
    data: { status: "REVOKED" },
  });
}

export async function listInvitations(agencyId: string) {
  return prisma.invitation.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
  });
}
