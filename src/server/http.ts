import { NextRequest, NextResponse } from "next/server";
import { PREVIEW_ORIGIN } from "@/lib/supabase/server";
const buckets = new Map<string, { count: number; end: number }>();
export function enforceMutation(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = new Set(
    [
      PREVIEW_ORIGIN,
      process.env.APP_ORIGIN,
      process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
      process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ].filter(Boolean),
  );
  if (!origin || !allowed.has(origin))
    throw new Error(
      "This request did not come from the application. Please refresh and try again.",
    );
  if (
    request.headers.get("sec-fetch-site") === "cross-site" &&
    origin !== PREVIEW_ORIGIN
  )
    throw new Error("This request is not permitted.");
}
export function rateLimit(key: string, limit = 40, windowMs = 60_000) {
  const now = Date.now();
  const item = buckets.get(key);
  if (!item || item.end < now) {
    buckets.set(key, { count: 1, end: now + windowMs });
  } else {
    if (item.count >= limit)
      throw new Error("Please wait a minute before trying again.");
    item.count++;
  }
  if (buckets.size > 5000)
    for (const [k, v] of buckets) if (v.end < now) buckets.delete(k);
}
export function failure(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : "We could not complete that action. Please try again.";
  const status =
    raw === "AUTH_REQUIRED"
      ? 401
      : [
            "ADMIN_REQUIRED",
            "PAID_MEMBERSHIP_REQUIRED",
            "COMMUNITY_SUSPENDED",
            "COMMUNITY_BANNED",
            "COMMUNITY_DISABLED",
            "COMMUNITY_VIDEO_DISABLED",
            "POSTING_BLOCKED",
            "VIDEOS_DAILY_LIMIT",
            "ACTIVE_VIDEO_LIMIT",
            "POSTING_LIMIT",
            "AI_SUPPORT_DISABLED",
            "AI_PUBLIC_DISABLED",
            "AI_LEARNER_DISABLED",
          ].includes(raw)
        ? 403
        : 400;
  const message =
    raw === "AUTH_REQUIRED"
      ? "Please sign in to continue."
      : raw === "ADMIN_REQUIRED"
        ? "Administrator access is required."
        : raw === "PAID_MEMBERSHIP_REQUIRED"
          ? "A paid membership is required to join the community."
          : raw === "COMMUNITY_SUSPENDED"
            ? "Your community access is temporarily suspended."
            : raw === "COMMUNITY_BANNED"
              ? "Your community access has been suspended permanently."
              : raw === "POSTING_BLOCKED"
                ? "Posting is temporarily restricted for your account."
                : raw === "COMMUNITY_DISABLED"
                  ? "The community is temporarily unavailable."
                  : raw === "COMMUNITY_VIDEO_DISABLED"
                    ? "Community video posting is temporarily unavailable."
                    : raw === "VIDEOS_DAILY_LIMIT"
                      ? "You have reached today’s community video limit."
                      : raw === "ACTIVE_VIDEO_LIMIT"
                        ? "Remove or publish one of your existing video drafts before uploading another."
                        : raw === "POSTING_LIMIT"
                          ? "Your current community posting limits do not allow another video post yet."
                    : raw === "AI_SUPPORT_DISABLED"
                    ? "AI support is temporarily unavailable."
                    : raw === "AI_PUBLIC_DISABLED"
                      ? "AI support is currently available to signed-in learners only."
                      : raw === "AI_LEARNER_DISABLED"
                        ? "AI support is temporarily unavailable for learners."
                  : raw;
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function checked(result: { data: any; error: any }): any {
  if (result.error) {
    console.error("database_operation_failed", result.error.code || "unknown");
    const message = result.error.message || "";
    if (result.error.code === "P0001" && message.length < 250)
      throw new Error(message);
    if (result.error.code === "23505")
      throw new Error(
        "That record already exists, or that time slot is no longer available.",
      );
    throw new Error(
      "We could not save that change. Check your details and try again.",
    );
  }
  return result.data;
}
