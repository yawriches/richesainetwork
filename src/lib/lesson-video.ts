export type YouTubeVideo = {
  videoId: string;
  embedUrl: string;
  watchUrl: string;
};

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
]);

function secureUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

function startSeconds(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match.slice(1).some(Boolean)) return null;
  const seconds =
    Number(match[1] || 0) * 3600 +
    Number(match[2] || 0) * 60 +
    Number(match[3] || 0);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

export function getYouTubeVideo(value: unknown): YouTubeVideo | null {
  const url = secureUrl(value);
  if (!url || url.port || !youtubeHosts.has(url.hostname)) return null;
  let videoId: string | null = null;
  if (url.hostname === "youtu.be") {
    const match = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/);
    videoId = match?.[1] || null;
  } else if (url.pathname === "/watch" && !url.hostname.includes("nocookie")) {
    videoId = url.searchParams.get("v");
  } else {
    const match = url.pathname.match(
      /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})\/?$/,
    );
    videoId = match?.[1] || null;
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  embed.searchParams.set("controls", "1");
  embed.searchParams.set("playsinline", "1");
  embed.searchParams.set("rel", "0");
  const watch = new URL("https://www.youtube.com/watch");
  watch.searchParams.set("v", videoId);
  const start = startSeconds(
    url.searchParams.get("start") || url.searchParams.get("t"),
  );
  if (start !== null && start > 0) {
    embed.searchParams.set("start", String(start));
    watch.searchParams.set("t", `${start}s`);
  }
  return { videoId, embedUrl: embed.href, watchUrl: watch.href };
}

export function lessonVideoSource(
  value: unknown,
):
  | { kind: "youtube"; source: YouTubeVideo }
  | { kind: "file"; url: string }
  | { kind: "unsupported" }
  | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const youtube = getYouTubeVideo(value);
  if (youtube) return { kind: "youtube", source: youtube };
  const url = secureUrl(value);
  if (!url || youtubeHosts.has(url.hostname)) return { kind: "unsupported" };
  return { kind: "file", url: url.href };
}
