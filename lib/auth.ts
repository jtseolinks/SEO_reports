import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { registerLoginAttempt, resetLoginAttempts } from "./rate-limit";
import type { MembershipRole } from "@/lib/generated/prisma/client";

/**
 * Resolve a user's active agency: the membership matching their
 * lastActiveAgencyId, else the oldest membership. Returns nulls if the user
 * belongs to no agency.
 */
async function resolveActiveAgency(
  userId: string,
  lastActiveAgencyId: string | null
): Promise<{ agencyId: string | null; membershipRole: MembershipRole | null }> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) return { agencyId: null, membershipRole: null };
  const active =
    memberships.find((m) => m.agencyId === lastActiveAgencyId) ?? memberships[0];
  return { agencyId: active.agencyId, membershipRole: active.role };
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Throttle by email + client IP to slow down brute-force attacks.
        const fwd = (req?.headers?.["x-forwarded-for"] as string | undefined) ?? "";
        const ip = fwd.split(",")[0].trim() || "unknown";
        const rateKey = `${credentials.email.toLowerCase()}|${ip}`;
        if (!registerLoginAttempt(rateKey)) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Successful login → clear the throttle counter.
        resetLoginAttempts(rateKey);

        const { agencyId, membershipRole } = await resolveActiveAgency(
          user.id,
          user.lastActiveAgencyId
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          agencyId,
          membershipRole,
        };
      },
    }),
  ],
  events: {
    // On every successful login, proactively refresh the active agency's Google
    // (GSC/GA4) token. `force` retries even when a prior failure left the
    // connection flagged REQUIRES_REAUTH, so a stuck connection recovers
    // automatically as long as the refresh token is still valid. Fire-and-forget.
    async signIn({ user }) {
      const agencyId = (user as { agencyId?: string | null }).agencyId;
      if (!agencyId) return;
      import("./google-oauth")
        .then(({ getValidAccessToken }) => getValidAccessToken(agencyId, { force: true }))
        .catch(() => {
          // Best-effort: a genuinely revoked/expired refresh token still needs a
          // manual reconnect, which the dashboard surfaces separately.
        });
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.agencyId = (user as { agencyId?: string | null }).agencyId ?? null;
        token.membershipRole =
          (user as { membershipRole?: MembershipRole | null }).membershipRole ?? null;
      }

      // Workspace switch: client calls update({ agencyId }) → re-issue the token
      // for the new agency, but only if the user actually belongs to it.
      if (trigger === "update" && session?.agencyId && token.id) {
        const m = await prisma.membership.findUnique({
          where: {
            userId_agencyId: { userId: token.id as string, agencyId: session.agencyId },
          },
        });
        if (m) {
          token.agencyId = m.agencyId;
          token.membershipRole = m.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.agencyId = (token.agencyId as string | null) ?? null;
        session.user.membershipRole = (token.membershipRole as MembershipRole | null) ?? null;
        session.user.memberships = token.id
          ? (
              await prisma.membership.findMany({
                where: { userId: token.id as string },
                include: { agency: { select: { name: true } } },
                orderBy: { createdAt: "asc" },
              })
            ).map((m) => ({
              agencyId: m.agencyId,
              agencyName: m.agency.name,
              role: m.role,
            }))
          : [];
      }
      return session;
    },
  },
};
