export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) redirect("/login");

  const role = session.user.membershipRole ?? "MEMBER";
  const currentUserId = session.user.id;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>משתמשים</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          חברי הצוות של הסוכנות והרשאותיהם
        </p>
      </div>
      <UsersClient currentUserRole={role} currentUserId={currentUserId} />
    </div>
  );
}
