import "server-only";

import { createHash } from "node:crypto";

export const BUNNY_TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";
export const COMMUNITY_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type CommunityVideoMimeType = (typeof COMMUNITY_VIDEO_MIME_TYPES)[number];

export type BunnyVideo = {
  guid: string;
  status: number;
  length: number;
  storageSize: number;
  encodeProgress: number;
  title: string;
};

type BunnyConfig = {
  apiKey: string;
  libraryId: string;
  tokenAuthKey: string;
};

function config(): BunnyConfig {
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const tokenAuthKey = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;
  if (!apiKey || !libraryId || !tokenAuthKey || !/^\d+$/.test(libraryId))
    throw new Error("BUNNY_STREAM_NOT_CONFIGURED");
  return { apiKey, libraryId, tokenAuthKey };
}

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function bunnyRequest(path: string, init: RequestInit = {}) {
  const { apiKey } = config();
  const response = await fetch(`https://video.bunnycdn.com${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      AccessKey: apiKey,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("bunny_stream_request_failed", response.status);
    throw new Error(response.status === 404 ? "BUNNY_VIDEO_NOT_FOUND" : "BUNNY_STREAM_UNAVAILABLE");
  }
  return response;
}

export function isCommunityVideoMimeType(value: string): value is CommunityVideoMimeType {
  return (COMMUNITY_VIDEO_MIME_TYPES as readonly string[]).includes(value);
}

export async function createBunnyCommunityVideo(title: string) {
  const { libraryId } = config();
  const response = await bunnyRequest(`/library/${libraryId}/videos`, {
    method: "POST",
    body: JSON.stringify({ title: title.slice(0, 180) || "Riches AI community video" }),
  });
  const video = (await response.json()) as BunnyVideo;
  if (!video.guid || !isGuid(video.guid)) throw new Error("BUNNY_STREAM_UNAVAILABLE");
  return video;
}

export async function getBunnyVideo(videoId: string) {
  if (!isGuid(videoId)) throw new Error("BUNNY_VIDEO_NOT_FOUND");
  const { libraryId } = config();
  const response = await bunnyRequest(`/library/${libraryId}/videos/${videoId}`);
  return (await response.json()) as BunnyVideo;
}

export async function deleteBunnyVideo(videoId: string) {
  if (!isGuid(videoId)) return;
  const { libraryId } = config();
  await bunnyRequest(`/library/${libraryId}/videos/${videoId}`, { method: "DELETE" });
}

export function createBunnyUploadCredentials(videoId: string, expiresInSeconds = 7_200) {
  if (!isGuid(videoId)) throw new Error("BUNNY_VIDEO_NOT_FOUND");
  const { apiKey, libraryId } = config();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const signature = createHash("sha256")
    .update(`${libraryId}${apiKey}${expiresAt}${videoId}`)
    .digest("hex");
  return { libraryId, videoId, expiresAt, signature, endpoint: BUNNY_TUS_ENDPOINT };
}

export function signedBunnyEmbedUrl(videoId: string, expiresInSeconds = 600) {
  if (!isGuid(videoId)) return null;
  const { libraryId, tokenAuthKey } = config();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const token = createHash("sha256")
    .update(`${tokenAuthKey}${videoId}${expiresAt}`)
    .digest("hex");
  const url = new URL(`https://player.mediadelivery.net/embed/${libraryId}/${videoId}`);
  url.searchParams.set("token", token);
  url.searchParams.set("expires", String(expiresAt));
  return url.toString();
}

export function communityVideoState(status: number) {
  // Bunny Stream webhook statuses: 3=finished, 4=first playable resolution,
  // 8=presigned upload failed; 9/10 are post-processing metadata events.
  if ([3, 4, 9, 10].includes(status)) return "READY";
  if ([5, 8].includes(status)) return "FAILED";
  if ([1, 2, 7].includes(status)) return "PROCESSING";
  return "UPLOADED";
}

export function communityVideoViolation(
  video: Pick<BunnyVideo, "length" | "storageSize">,
  limits: { max_video_upload_mb: number; max_video_duration_seconds: number },
) {
  // Bunny storageSize includes the original *and* all transcoded resolutions;
  // it must not be compared to the source-file limit enforced at reservation.
  if (Number(video.length) > Number(limits.max_video_duration_seconds))
    return `This video exceeds the ${limits.max_video_duration_seconds}-second community video limit.`;
  return null;
}
