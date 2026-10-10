import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, serviceClient } from "@/lib/supabase/server";
import {
  COMMUNITY_VIDEO_MIME_TYPES,
  createBunnyCommunityVideo,
  createBunnyUploadCredentials,
  deleteBunnyVideo,
  getBunnyVideo,
  isCommunityVideoMimeType,
} from "@/server/bunny-stream";
import { checked, enforceMutation, failure, rateLimit } from "@/server/http";

const input = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.string().trim(),
  size_bytes: z.coerce.number().int().min(1).max(1_048_576_000),
  resume_video_id: z.uuid().optional(),
});

async function purgeExpiredDrafts(userId: string) {
  const service = serviceClient();
  const expired = checked(
    await service
      .from("community_videos")
      .select("id,bunny_video_id,status")
      .eq("author_id", userId)
      .is("post_id", null)
      .in("status", ["EXPIRED", "FAILED", "REJECTED"])
      .not("bunny_video_id", "is", null)
      .limit(10),
  ) || [];
  for (const draft of expired) {
    if (draft.bunny_video_id) {
      try {
        await deleteBunnyVideo(draft.bunny_video_id);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "BUNNY_VIDEO_NOT_FOUND") {
          console.error("community_video_expired_cleanup_failed", draft.id);
          continue;
        }
      }
    }
    await service
      .from("community_videos")
      .update({ bunny_video_id: null, ...(draft.status === "EXPIRED" ? { status: "DELETED", processing_error: "Unattached upload draft removed." } : {}) })
      .eq("id", draft.id)
      .eq("author_id", userId);
  }
}

export async function POST(request: NextRequest) {
  let reservationId: string | null = null;
  let remoteGuid: string | null = null;
  try {
    enforceMutation(request);
    const { user, db } = await identity();
    rateLimit(`community-video-upload:${user.id}`, 4, 60_000);
    const values = input.parse(await request.json());
    if (!isCommunityVideoMimeType(values.mime_type))
      throw new Error("Choose an MP4, MOV, or WebM video.");

    const service = serviceClient();
    if (values.resume_video_id) {
      const access = checked(await db.rpc("community_access", { p_user_id: user.id }));
      if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
      if (!access.can_post) throw new Error(access.posting_reason || "POSTING_LIMIT");
      if (access.limits?.video_enabled === false) throw new Error("COMMUNITY_VIDEO_DISABLED");
      const draft = checked(await service.from("community_videos")
        .select("id,bunny_video_id,author_id,source_filename,mime_type,declared_size_bytes,status,post_id,upload_expires_at")
        .eq("id", values.resume_video_id).eq("author_id", user.id).maybeSingle());
      if (!draft || draft.status !== "UPLOAD_CREATED" || draft.post_id || !draft.bunny_video_id ||
          Date.now() >= new Date(draft.upload_expires_at).getTime())
        throw new Error("This upload can no longer be resumed. Remove the draft and try again.");
      if (draft.source_filename !== values.file_name || draft.mime_type !== values.mime_type ||
          Number(draft.declared_size_bytes) !== values.size_bytes)
        throw new Error("Choose the same original video file to resume this upload.");
      if (values.size_bytes > Number(access.limits?.max_video_upload_mb || 250) * 1024 * 1024)
        throw new Error("This video exceeds the current community upload size limit.");
      const remote = await getBunnyVideo(draft.bunny_video_id);
      if (![0, 6].includes(Number(remote.status)))
        throw new Error("Bunny has already received this video. Use Check status instead.");
      return NextResponse.json({ ok: true, data: {
        community_video_id: draft.id,
        upload: createBunnyUploadCredentials(draft.bunny_video_id),
        accepted_mime_types: COMMUNITY_VIDEO_MIME_TYPES,
        max_file_size_bytes: Number(access.limits?.max_video_upload_mb || 250) * 1024 * 1024,
      }, message: "Resuming the secure Bunny upload." }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const reservation = checked(
      await service.rpc("community_video_reserve", {
        p_user_id: user.id,
        p_source_filename: values.file_name,
        p_mime_type: values.mime_type,
        p_declared_size_bytes: values.size_bytes,
      }),
    );
    reservationId = reservation.id;
    await purgeExpiredDrafts(user.id);

    const remote = await createBunnyCommunityVideo("Riches AI community video");
    remoteGuid = remote.guid;
    const credentials = createBunnyUploadCredentials(remote.guid);
    const video = checked(
      await service
        .from("community_videos")
        .update({
          bunny_video_id: remote.guid,
          bunny_status: Number(remote.status || 0),
          status: "UPLOAD_CREATED",
          upload_expires_at: new Date(credentials.expiresAt * 1000).toISOString(),
        })
        .eq("id", reservationId)
        .eq("author_id", user.id)
        .select("id,status,upload_expires_at")
        .single(),
    );

    return NextResponse.json(
      {
        ok: true,
        data: {
          community_video_id: video.id,
          upload: credentials,
          accepted_mime_types: COMMUNITY_VIDEO_MIME_TYPES,
          max_file_size_bytes: Number(reservation.limits?.max_video_upload_mb || 250) * 1024 * 1024,
        },
        message: "Your secure video upload is ready.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (reservationId) {
      if (remoteGuid) {
        try {
          await deleteBunnyVideo(remoteGuid);
          remoteGuid = null;
        } catch (cleanupError) {
          console.error("community_video_setup_cleanup_failed", reservationId);
        }
      }
      await serviceClient()
        .from("community_videos")
        .update({ status: "FAILED", bunny_video_id: remoteGuid, processing_error: "The upload session could not be prepared." })
        .eq("id", reservationId);
    }
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message || "Choose a valid video file." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } },
      );
    return failure(error);
  }
}
