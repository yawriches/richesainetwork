"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { lessonVideoSource } from "@/lib/lesson-video";

export function LessonVideo({ src, title }: { src: string; title: string }) {
  const media = lessonVideoSource(src);
  if (!media) return null;
  if (media.kind === "unsupported") {
    return (
      <p className="form-alert" role="status">
        This video link cannot be previewed. Use a YouTube video share/watch
        link, a direct HTTPS video URL, or an uploaded course video.
      </p>
    );
  }
  if (media.kind === "youtube") {
    return (
      <div style={{ marginBottom: 20, minWidth: 0 }}>
        <div
          style={{
            position: "relative",
            aspectRatio: "16 / 9",
            minHeight: 200,
            width: "100%",
            overflow: "hidden",
            borderRadius: 13,
            background: "#101814",
          }}
        >
          <iframe
            key={media.source.embedUrl}
            src={media.source.embedUrl}
            title={`${title} — YouTube video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
          />
        </div>
        <p className="field-hint" style={{ margin: "9px 0 0" }}>
          <a
            href={media.source.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            Watch on YouTube <ExternalLink size={13} />
          </a>
          {" · If playback is blocked here, open the video on YouTube."}
        </p>
      </div>
    );
  }
  return <FileVideo key={media.url} src={media.url} title={title} />;
}

function FileVideo({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <video
        controls
        playsInline
        preload="metadata"
        src={src}
        onError={() => setFailed(true)}
        style={{ display: "block", width: "100%", borderRadius: 13 }}
        aria-label={`${title} video`}
      />
      {failed && (
        <p className="form-alert" role="status">
          This video could not be played. Use a supported video file or YouTube
          link. If it is a protected upload, refresh the lesson to renew its
          access link.
        </p>
      )}
    </div>
  );
}
