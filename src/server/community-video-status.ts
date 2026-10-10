import "server-only";

import { serviceClient } from "@/lib/supabase/server";
import { checked } from "@/server/http";
import {
  communityVideoState,
  communityVideoViolation,
  deleteBunnyVideo,
  getBunnyVideo,
} from "@/server/bunny-stream";

type Draft = {
  id: string;
  bunny_video_id: string | null;
  status: string;
  post_id?: string | null;
  created_at: string;
  upload_expires_at?: string | null;
};
type Limits = { max_video_upload_mb: number; max_video_duration_seconds: number };
export const DRAFT_FIELDS = "id,source_filename,status,bunny_status,declared_size_bytes,storage_size_bytes,duration_seconds,processing_error,created_at,updated_at";

/** Bunny, not the webhook or a cached row, is authoritative for a member's draft. */
export async function reconcileCommunityVideo(record: Draft, limits: Limits) {
  if (!record.bunny_video_id || record.post_id ||
      ["DELETED", "EXPIRED", "HIDDEN"].includes(record.status))
    return null;
  const service = serviceClient();
  if (["FAILED", "REJECTED"].includes(record.status)) {
    try {
      await deleteBunnyVideo(record.bunny_video_id);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "BUNNY_VIDEO_NOT_FOUND") {
        console.error("community_video_cleanup_retry_failed", record.id);
        return null;
      }
    }
    return checked(await service.from("community_videos")
      .update({ bunny_video_id: null })
      .eq("id", record.id).eq("bunny_video_id", record.bunny_video_id)
      .select(DRAFT_FIELDS).maybeSingle());
  }
  const remote = await getBunnyVideo(record.bunny_video_id);
  const violation = communityVideoViolation(remote, limits);
  let status = communityVideoState(Number(remote.status));
  let processingError = "";
  if (violation) {
    status = "REJECTED";
    processingError = violation;
  } else if (Number(remote.status) === 0 && Number(remote.storageSize || 0) === 0 &&
    record.status === "UPLOAD_CREATED" &&
    Date.now() > new Date(record.upload_expires_at || record.created_at).getTime()) {
    // Never call an in-flight upload failed after 90 seconds: mobile uploads
    // can take minutes. An expired upload is no longer resumable.
    status = "FAILED";
    processingError = "The upload expired without reaching Bunny. Remove this draft and try again.";
  } else if (status === "FAILED") {
    processingError = "Bunny could not process this video. Remove this draft and try another file.";
  }
  let update = service.from("community_videos")
    .update({
      status,
      bunny_status: Number(remote.status),
      storage_size_bytes: Number(remote.storageSize || 0),
      duration_seconds: Number(remote.length || 0),
      processing_error: processingError,
    })
    .eq("id", record.id)
    .eq("bunny_video_id", record.bunny_video_id)
    .is("post_id", null)
    .not("status", "in", '(DELETED,EXPIRED,REJECTED,HIDDEN,FAILED)');
  if (status !== "READY") update = update.neq("status", "READY");
  const result = checked(await update.select(`${DRAFT_FIELDS},bunny_video_id`).maybeSingle());
  if (result && ["REJECTED", "FAILED"].includes(status)) {
    try {
      await deleteBunnyVideo(record.bunny_video_id);
      checked(await service.from("community_videos")
        .update({ bunny_video_id: null })
        .eq("id", record.id).eq("bunny_video_id", record.bunny_video_id));
      return { ...result, bunny_video_id: null };
    } catch (error) {
      if (error instanceof Error && error.message === "BUNNY_VIDEO_NOT_FOUND") {
        checked(await service.from("community_videos")
          .update({ bunny_video_id: null })
          .eq("id", record.id).eq("bunny_video_id", record.bunny_video_id));
        return { ...result, bunny_video_id: null };
      }
      console.error("community_video_cleanup_failed", record.id);
    }
  }
  return result;
}
