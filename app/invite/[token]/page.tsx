import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { AcceptForm } from "./accept-form";
import { HashMark } from "@/components/brand/hash-mark";
import { AlertCircle } from "lucide-react";

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invite = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { agency: { select: { name: true } } },
  });

  if (!invite) {
    return <ErrorPage message="קישור ההזמנה לא תקין או שכבר פג תוקפו." />;
  }
  if (invite.status === "ACCEPTED") {
    return <ErrorPage message="הזמנה זו כבר אושרה." />;
  }
  if (invite.status === "REVOKED") {
    return <ErrorPage message="הזמנה זו בוטלה על ידי מנהל הסוכנות." />;
  }
  if (invite.expiresAt < new Date()) {
    return <ErrorPage message="תוקף ההזמנה פג. בקש מהמנהל לשלוח הזמנה חדשה." />;
  }

  const userExists = !!(await prisma.user.findUnique({ where: { email: invite.email } }));

  return (
    <AcceptForm
      token={token}
      agencyName={invite.agency.name}
      email={invite.email}
      role={invite.role}
      userExists={userExists}
    />
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: "var(--r-xl)",
        boxShadow: "var(--shadow-lg)", overflow: "hidden",
      }}>
        <div style={{
          background: "linear-gradient(180deg, var(--brand-navy) 0%, var(--brand-navy-deep) 100%)",
          padding: "28px 32px 24px", textAlign: "center",
        }}>
          <div style={{
            display: "inline-grid", placeItems: "center",
            width: 44, height: 44, borderRadius: 12,
            background: "rgba(91,194,240,0.15)", marginBottom: 12,
          }}>
            <HashMark size={24} color="var(--brand-cyan)" />
          </div>
          <div style={{ color: "white", fontWeight: 700, fontSize: 20 }}>Rankey</div>
        </div>
        <div style={{ padding: "32px", textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", background: "var(--red-soft)",
            display: "grid", placeItems: "center", margin: "0 auto 16px",
          }}>
            <AlertCircle size={24} style={{ color: "var(--red)" }} />
          </div>
          <p style={{ fontSize: 15, color: "var(--text)", marginBottom: 20, lineHeight: 1.6 }}>
            {message}
          </p>
          <a href="/login" className="btn btn-secondary" style={{ display: "inline-flex" }}>
            חזור לדף הכניסה
          </a>
        </div>
      </div>
    </div>
  );
}
