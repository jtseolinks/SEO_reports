import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { registerLoginAttempt, resetLoginAttempts } from "./rate-limit";

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

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  events: {
    // On every successful login, proactively refresh the Google (GSC/GA4)
    // access token. `force` retries even when a prior failure left the
    // connection flagged REQUIRES_REAUTH, so a stuck connection recovers
    // automatically as long as the refresh token is still valid — no manual
    // disconnect/reconnect needed. Fire-and-forget so login latency is unaffected.
    async signIn() {
      import("./google-oauth")
        .then(({ getValidAccessToken }) => getValidAccessToken({ force: true }))
        .catch(() => {
          // Best-effort: a genuinely revoked/expired refresh token still needs a
          // manual reconnect, which the dashboard surfaces separately.
        });
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
