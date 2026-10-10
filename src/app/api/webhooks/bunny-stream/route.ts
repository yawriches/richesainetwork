import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reconcileCommunityVideo } from "@/server/community-video-status";
import { serviceClient } from "@/lib/supabase/server";
import { checked } from "@/server/http";

const callback = z.object({
  VideoLibraryId: z.coerce.number().int().positive(),
  VideoGuid: z.uuid(),
  Status: z.coerce.number().int().min(0).max(10),
});

function signatureIsValid(request: NextRequest, rawBody: string) {
  const secret = process.env.BUNNY_STREAM_READ_ONLY_API_KEY;
  const received = request.headers.get("x-bunnystream-signature") || "";
  if (
    !secret ||
    request.headers.get("x-bunnystream-signature-version") !== "v1" ||
    request.headers.get("x-bunnystream-signature-algorithm") !== "hmac-sha256" ||
    !/^[0-9a-f]{64}$/.test(received)
  )
    return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  try {
    if (!signatureIsValid(request, rawBody))
      return NextResponse.json({ ok: false }, { status: 401 });
    const event = callback.parse(JSON.parse(rawBody));
    if (String(event.VideoLibraryId) !== process.env.BUNNY_STREAM_LIBRARY_ID)
      return NextResponse.json({ ok: false }, { status: 404 });

    const service = serviceClient();
    const record = checked(
      await service
        .from("community_videos")
        .select("id,status,author_id,bunny_video_id,post_id,created_at,upload_expires_at")
        .eq("bunny_video_id", event.VideoGuid)
        .maybeSingle(),
    );
    if (!record || record.post_id || ["DELETED", "EXPIRED", "REJECTED", "HIDDEN", "FAILED"].includes(record.status))
      return NextResponse.json({ ok: true });

    const settings = await service.from("community_settings")
      .select("max_video_upload_mb,max_video_duration_seconds").eq("id", true).single();
    const limits = checked(settings);
    await reconcileCommunityVideo(record, limits);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("bunny_stream_webhook_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
