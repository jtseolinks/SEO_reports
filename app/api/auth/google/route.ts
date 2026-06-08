import { NextResponse } from "next/server";
import { requireAgencyAdmin, toResponse } from "@/lib/authz";
import { getAuthorizationUrl, OAUTH_STATE_COOKIE, signOAuthState } from "@/lib/google-oauth";

export async function GET() {
  let ctx;
  try {
    ctx = await requireAgencyAdmin();
  } catch (e) {
    return toResponse(e);
  }

  // CSRF + agency binding: the state carries the agency id and an HMAC, and is
  // also echoed in this cookie. The callback validates both.
  const state = signOAuthState(ctx.agencyId);
  const url = getAuthorizationUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
