import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeAndSave, OAUTH_STATE_COOKIE, parseOAuthState } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const activeAgencyId = session.user.agencyId;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (error) {
    const redirectUrl = new URL("/admin/google", request.url);
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  // CSRF protection: the state echoed by Google must match the cookie set when
  // the flow began.
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    const redirectUrl = new URL("/admin/google", request.url);
    redirectUrl.searchParams.set("error", "invalid_state");
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  }

  // The state is HMAC-signed and carries the agency id that initiated the flow.
  // It must verify AND match the caller's active agency (defense against a
  // mid-flow workspace switch binding credentials to the wrong agency).
  const stateAgencyId = parseOAuthState(state);
  if (!stateAgencyId || stateAgencyId !== activeAgencyId) {
    const redirectUrl = new URL("/admin/google", request.url);
    redirectUrl.searchParams.set("error", "invalid_state");
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  }

  if (!code) {
    const redirectUrl = new URL("/admin/google", request.url);
    redirectUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await exchangeCodeAndSave(activeAgencyId, code);
    const redirectUrl = new URL("/admin/google", request.url);
    redirectUrl.searchParams.set("success", "1");
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    const redirectUrl = new URL("/admin/google", request.url);
    redirectUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "token_exchange_failed"
    );
    return NextResponse.redirect(redirectUrl);
  }
}
