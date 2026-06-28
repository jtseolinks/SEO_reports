import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import { getPlatformSettings, savePlatformSettings, maskSecrets } from "@/lib/platform-settings";

// Platform-wide SMTP configuration - single source of truth for all outgoing
// mail. Super-admin only. Secrets are masked on the way out and preserved when
// the masked placeholder is sent back unchanged.

export async function GET() {
  try {
    await requireSuperAdmin();
    const settings = await getPlatformSettings();
    return NextResponse.json(maskSecrets(settings));
  } catch (e) {
    return toResponse(e);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const body = await request.json();
    await savePlatformSettings(body);
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
