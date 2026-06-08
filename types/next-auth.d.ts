import "next-auth";
import "next-auth/jwt";
import type { MembershipRole } from "@/lib/generated/prisma/client";

type SessionMembership = { agencyId: string; agencyName: string; role: MembershipRole };

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      // Active agency (tenant) for this session — null if the user has no membership.
      agencyId: string | null;
      membershipRole: MembershipRole | null;
      // All agencies the user belongs to (for the workspace switcher). Session-only.
      memberships: SessionMembership[];
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    role: string;
    agencyId?: string | null;
    membershipRole?: MembershipRole | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    agencyId: string | null;
    membershipRole: MembershipRole | null;
  }
}
