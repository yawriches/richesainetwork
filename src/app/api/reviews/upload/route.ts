import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { identity, serviceClient } from "@/lib/supabase/server";
import { checked, enforceMutation, failure, rateLimit } from "@/server/http";
export const runtime = "nodejs";
const exec = promisify(execFile);
export async function POST(request: NextRequest) {
  let directory: string | undefined, path: string | undefined;
  let accepted = false;
  try {
    enforceMutation(request);
    const { db, user } = await identity();
    rateLimit(`upload:${user.id}`, 4);
    const service = serviceClient();
    const settings = checked(
      await service
        .from("business_settings")
        .select("key,value")
        .eq("active", true)
        .in("key", [
          "review.video_max_duration_seconds",
          "review.video_max_size_bytes",
          "review.allowed_mime_types",
        ]),
    );
    const values = Object.fromEntries(
      (settings || []).map((s: any) => [s.key, s.value]),
    );
    const maxBytes = Number(values["review.video_max_size_bytes"]);
    const maxSeconds = Number(values["review.video_max_duration_seconds"]);
    const allowed = values["review.allowed_mime_types"];
    if (!maxBytes || !maxSeconds || !Array.isArray(allowed))
      throw new Error(
        "Video submission settings are not configured. Please contact support.",
      );
    if (Number(request.headers.get("content-length") || 0) > maxBytes + 65536)
      throw new Error("That upload is larger than the allowed limit.");
    // Bound the actual stream as well: Content-Length and browser metadata are untrusted.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Choose a video to upload.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > maxBytes + 65536) {
        await reader.cancel();
        throw new Error("That upload is larger than the allowed limit.");
      }
      chunks.push(chunk.value);
    }
    const bounded = new Request("http://internal.local/upload", {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "" },
      body: Buffer.concat(chunks),
    });
    const form = await bounded.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > maxBytes)
      throw new Error("Choose a video within the allowed file-size limit.");
    const buffer = Buffer.from(await file.arrayBuffer());
    directory = await mkdtemp(join(tmpdir(), "arn-review-"));
    const local = join(directory, "video");
    await writeFile(local, buffer);
    let probe: any;
    try {
      const result = await exec(
        "ffprobe",
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-show_entries",
          "format=duration,format_name:stream=codec_type,codec_name,duration",
          "-of",
          "json",
          local,
        ],
        { timeout: 20000, maxBuffer: 1_000_000 },
      );
      probe = JSON.parse(result.stdout);
    } catch {
      throw new Error(
        "We could not read that video. Upload a valid MP4 or WebM file.",
      );
    }
    const format = String(probe.format?.format_name || "");
    const mp4 =
      buffer.subarray(4, 8).toString() === "ftyp" && format.includes("mp4");
    const webm =
      buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
      format.includes("webm");
    const quicktime = mp4 && buffer.subarray(8, 12).toString() === "qt  ";
    const actualMime = quicktime
      ? "video/quicktime"
      : mp4
        ? "video/mp4"
        : webm
          ? "video/webm"
          : null;
    if (
      !actualMime ||
      !allowed.includes(actualMime) ||
      !probe.streams?.some((s: any) => s.codec_type === "video")
    )
      throw new Error(
        "This file format is not supported. Choose a permitted video type.",
      );
    const durations = [
      Number(probe.format.duration),
      ...(probe.streams || [])
        .map((s: any) => Number(s.duration))
        .filter(Number.isFinite),
    ];
    const duration = Math.ceil(Math.max(...durations) * 1000) / 1000;
    if (!Number.isFinite(duration) || duration <= 0 || duration > maxSeconds)
      throw new Error(
        `Your video must be no longer than ${maxSeconds} seconds.`,
      );
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const question = String(form.get("question") || "").trim();
    if (
      title.length < 2 ||
      title.length > 180 ||
      description.length > 5000 ||
      question.length > 5000
    )
      throw new Error(
        "Add a project title and keep your request under the displayed limits.",
      );
    path = `${user.id}/${randomUUID()}.${quicktime ? "mov" : mp4 ? "mp4" : "webm"}`;
    checked(
      await service.storage
        .from("review-videos")
        .upload(path, buffer, { contentType: actualMime, upsert: false }),
    );
    checked(
      await service.from("validated_uploads").insert({
        user_id: user.id,
        video_path: path,
        video_size: file.size,
        video_duration: duration,
        mime_type: actualMime,
      }),
    );
    const review = checked(
      await db.rpc("submit_review", {
        p_title: title,
        p_project_category: String(form.get("project_category") || ""),
        p_review_category: String(form.get("review_category") || ""),
        p_description: description,
        p_question: question,
        p_video_path: path,
        p_video_size: file.size,
        p_video_duration: duration,
        p_mime_type: actualMime,
      }),
    );
    accepted = true;
    return NextResponse.json(
      {
        ok: true,
        data: { id: review },
        message: "Your project has been submitted for review.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (path && !accepted) {
      await serviceClient().storage.from("review-videos").remove([path]);
      await serviceClient()
        .from("validated_uploads")
        .delete()
        .eq("video_path", path);
    }
    return failure(error);
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
