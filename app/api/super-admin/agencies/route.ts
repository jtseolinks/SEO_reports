import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import { createSetupToken } from "@/lib/setup-token";
import { sendOnboardingEmail } from "@/lib/email";
import { isPlatformSmtpConfigured } from "@/lib/platform-settings";

async function uniqueSlug(base: string): Promise<string> {
  const slug =
    base
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48) || "agency";

  const existing = await prisma.agency.findMany({
    where: { slug: { startsWith: slug } },
    select: { slug: true },
  });
  if (!existing.find((a) => a.slug === slug)) return slug;
  for (let i = 2; i <= 99; i++) {
    const c = `${slug}-${i}`;
    if (!existing.find((a) => a.slug === c)) return c;
  }
  return `${slug}-${Date.now()}`;
}

// List all agencies with stats + setup score.
export async function GET() {
  try {
    await requireSuperAdmin();
    const [agencies, allSettings, smtpReady] = await Promise.all([
      prisma.agency.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { memberships: true, clients: true, monthlyReports: true } },
          googleConnection: { select: { status: true, googleEmail: true } },
          memberships: {
            where: { role: "OWNER" },
            include: { user: { select: { email: true, name: true, passwordHash: true } } },
            take: 1,
          },
        },
      }),
      prisma.agencySetting.findMany({
        where: { key: { in: ["agencyName"] } },
        select: { agencyId: true, key: true, value: true },
      }),
      // SMTP is now a single platform-wide config, shared by all agencies.
      isPlatformSmtpConfigured(),
    ]);

    // Build settings lookup: agencyId → { agencyName? }
    const settingsMap: Record<string, Record<string, string>> = {};
    for (const s of allSettings) {
      if (!settingsMap[s.agencyId]) settingsMap[s.agencyId] = {};
      settingsMap[s.agencyId][s.key] = s.value;
    }

    return NextResponse.json({
      agencies: agencies.map((a) => {
        const settings = settingsMap[a.id] ?? {};
        const ownerUser = a.memberships[0]?.user;

        // 5 setup criteria × 20% each
        const checks = [
          !!ownerUser?.passwordHash,                                // 1. owner has password
          !!(settings["agencyName"]?.trim()),                       // 2. agency name configured
          a.googleConnection?.status === "CONNECTED",               // 3. Google connected
          a._count.memberships > 1,                                 // 4. has team (> owner)
          smtpReady,                                                // 5. platform SMTP configured
        ];
        const setupPercent = Math.round((checks.filter(Boolean).length / checks.length) * 100);

        return {
          id: a.id,
          name: a.name,
          slug: a.slug,
          createdAt: a.createdAt,
          memberCount: a._count.memberships,
          clientCount: a._count.clients,
          reportCount: a._count.monthlyReports,
          googleStatus: a.googleConnection?.status ?? null,
          googleEmail: a.googleConnection?.googleEmail ?? null,
          owner: ownerUser
            ? { email: ownerUser.email, name: ownerUser.name }
            : null,
          ownerSetupPending: ownerUser ? !ownerUser.passwordHash : false,
          setupPercent,
          setupChecks: {
            password: checks[0],
            agencyName: checks[1],
            google: checks[2],
            team: checks[3],
            smtp: checks[4],
          },
        };
      }),
    });
  } catch (e) {
    return toResponse(e);
  }
}

// Create a new agency with an owner - sends onboarding email with setup wizard link.
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const { agencyName, ownerEmail, ownerName } = (await req.json()) as {
      agencyName: string;
      ownerEmail: string;
      ownerName?: string;
    };

    if (!agencyName?.trim())
      return NextResponse.json({ error: "שם הסוכנות נדרש" }, { status: 400 });
    if (!ownerEmail?.trim())
      return NextResponse.json({ error: "מייל בעלים נדרש" }, { status: 400 });

    const emailLower = ownerEmail.trim().toLowerCase();
    const slug = await uniqueSlug(agencyName.trim());

    // Create agency + user (no password yet) + membership in transaction
    const { agency, userId } = await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({ data: { name: agencyName.trim(), slug } });

      let owner = await tx.user.findUnique({ where: { email: emailLower } });
      if (!owner) {
        owner = await tx.user.create({
          data: {
            email: emailLower,
            name: ownerName?.trim() || null,
            // passwordHash intentionally null - must be set via onboarding
          },
        });
      }

      // Only add OWNER membership if not already a member
      const existing = await tx.membership.findUnique({
        where: { userId_agencyId: { userId: owner.id, agencyId: agency.id } },
      });
      if (!existing) {
        await tx.membership.create({
          data: { userId: owner.id, agencyId: agency.id, role: "OWNER" },
        });
      }

      return { agency, userId: owner.id };
    });

    // Generate setup token - isAgencySetup=true → founding owner gets full wizard
    const rawToken = await createSetupToken(userId, agency.id, { isAgencySetup: true });
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
    const setupUrl = `${baseUrl}/onboard/${rawToken}`;

    // Attempt to send onboarding email - non-fatal
    let emailSent = false;
    let emailError = "";
    try {
      await sendOnboardingEmail(emailLower, agencyName.trim(), setupUrl);
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Email send failed";
      console.error("[onboarding email]", emailError);
    }

    return NextResponse.json(
      {
        agencyId: agency.id,
        name: agency.name,
        slug: agency.slug,
        emailSent,
        // Return setupUrl so super-admin can copy it manually if email fails
        setupUrl: emailSent ? undefined : setupUrl,
        emailError: emailSent ? undefined : emailError,
      },
      { status: 201 }
    );
  } catch (e) {
    return toResponse(e);
  }
}
