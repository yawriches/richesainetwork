import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { identity } from "@/lib/supabase/server";
import { checked, enforceMutation, failure, rateLimit } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    enforceMutation(request);
    const { db, user, profile } = await identity();
    rateLimit(`assets:${user.id}`, 12);
    const maxBytes = 100 * 1024 * 1024;
    if (Number(request.headers.get("content-length") || 0) > maxBytes + 65536)
      throw new Error("That file is too large.");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Choose a file.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > maxBytes + 65536) {
        await reader.cancel();
        throw new Error("That file is too large.");
      }
      chunks.push(part.value);
    }
    const form = await new Request("http://internal.local/assets", {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "" },
      body: Buffer.concat(chunks),
    }).formData();
    const bucket = String(form.get("bucket") || "");
    if (
      ![
        "course-thumbnails",
        "course-assets",
        "ai-drop-media",
        "community-media",
        "avatars",
      ].includes(bucket)
    )
      throw new Error("Choose a permitted asset destination.");
    let communityImageLimit = 10;
    if (bucket === "community-media") {
      const access = checked(
        await db.rpc("community_access", { p_user_id: user.id }),
      );
      if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
      if (!access.can_post)
        throw new Error(
          access.posting_reason || "You have reached the community posting limit.",
        );
      communityImageLimit = Number(access.limits?.image_size_mb || 10);
    }
    if (!['avatars', 'community-media'].includes(bucket) && profile.role !== "ADMIN")
      throw new Error("ADMIN_REQUIRED");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size)
      throw new Error("Choose a file to upload.");
    const data = Buffer.from(await file.arrayBuffer());
    let mime: string | null = null,
      ext = "";
    if (
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      mime = "image/png";
      ext = "png";
    } else if (data[0] === 255 && data[1] === 216 && data[2] === 255) {
      mime = "image/jpeg";
      ext = "jpg";
    } else if (
      data.subarray(0, 4).toString() === "RIFF" &&
      data.subarray(8, 12).toString() === "WEBP"
    ) {
      mime = "image/webp";
      ext = "webp";
    } else if (
      data.subarray(0, 6).toString() === "GIF87a" ||
      data.subarray(0, 6).toString() === "GIF89a"
    ) {
      mime = "image/gif";
      ext = "gif";
    } else if (data.subarray(0, 5).toString() === "%PDF-") {
      mime = "application/pdf";
      ext = "pdf";
    } else if (data.subarray(4, 8).toString() === "ftyp") {
      mime = "video/mp4";
      ext = "mp4";
    } else if (
      data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    ) {
      mime = "video/webm";
      ext = "webm";
    }
    if (!mime)
      throw new Error(
        "Choose a supported PNG, JPEG, WebP, PDF, MP4, or WebM file.",
      );
    const imageOnly = ["avatars", "course-thumbnails", "community-media"].includes(bucket);
    if (imageOnly && !mime.startsWith("image/"))
      throw new Error("Choose a supported image for this field.");
    const limit =
      bucket === "avatars"
        ? 5 * 1024 * 1024
        : bucket === "course-thumbnails"
          ? 10 * 1024 * 1024
          : bucket === "ai-drop-media"
            ? 50 * 1024 * 1024
            : bucket === "community-media"
              ? communityImageLimit * 1024 * 1024
              : maxBytes;
    if (file.size > limit)
      throw new Error(
        "That file exceeds the allowed size for this destination.",
      );
    let folder = user.id;
    if (bucket === "course-assets") {
      folder = z.uuid().parse(form.get("course_id"));
      checked(await db.from("courses").select("id").eq("id", folder).single());
    }
    if (bucket === "ai-drop-media") {
      folder = z.uuid().parse(form.get("drop_id"));
      checked(await db.from("ai_drops").select("id").eq("id", folder).single());
    }
    const path = `${folder}/${randomUUID()}.${ext}`;
    checked(
      await db.storage
        .from(bucket)
        .upload(path, data, { contentType: mime, upsert: false }),
    );
    const url = ["avatars", "course-thumbnails"].includes(bucket)
      ? db.storage.from(bucket).getPublicUrl(path).data.publicUrl
      : null;
    return NextResponse.json(
      {
        ok: true,
        data: { url, path, bucket, storage_path: `${bucket}/${path}` },
        message: "Your file is securely stored.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
