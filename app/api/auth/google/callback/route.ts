import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeAndSave } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    const redirectUrl = new URL("/admin/google", request.url);
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL("/admin/google", request.url);
    redirectUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await exchangeCodeAndSave(code);
    const redirectUrl = new URL("/admin/google", request.url);
    redirectUrl.searchParams.set("success", "1");
    return NextResponse.redirect(redirectUrl);
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
