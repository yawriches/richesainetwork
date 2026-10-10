import { NextRequest, NextResponse } from "next/server";
import { userClient, PREVIEW_ORIGIN } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const path = next === "/reset-password" ? "/reset-password" : "/onboarding";
  if (code) {
    const db = await userClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(path, process.env.APP_ORIGIN || PREVIEW_ORIGIN),
      );
  }
  return NextResponse.redirect(
    new URL(
      "/login?error=verification",
      process.env.APP_ORIGIN || PREVIEW_ORIGIN,
    ),
  );
}
