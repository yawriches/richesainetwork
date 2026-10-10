import test from "node:test";
import assert from "node:assert/strict";
import { getYouTubeVideo, lessonVideoSource } from "../src/lib/lesson-video.ts";

const id = "GhaFPeBBesA";
test("supplied YouTube share link becomes a privacy-enhanced embed, not a video file", () => {
  const input = "https://youtu.be/GhaFPeBBesA?si=Fj9OFaISz97TOsQO";
  const video = getYouTubeVideo(input);
  assert.equal(video.videoId, id);
  const embed = new URL(video.embedUrl);
  assert.equal(embed.origin, "https://www.youtube-nocookie.com");
  assert.equal(embed.pathname, "/embed/" + id);
  assert.equal(embed.searchParams.has("si"), false);
  assert.equal(embed.searchParams.get("playsinline"), "1");
  assert.equal(lessonVideoSource(input).kind, "youtube");
  assert.equal(video.watchUrl, "https://www.youtube.com/watch?v=" + id);
});
test("watch, mobile, shorts, live and embed YouTube links select the same video", () => {
  for (const input of [
    `https://www.youtube.com/watch?v=${id}&list=ignored`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`,
    `https://youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    ` https://youtu.be/${id} `,
  ])
    assert.equal(getYouTubeVideo(input)?.videoId, id);
});
test("legitimate start offsets survive while sharing/tracking/player overrides are ignored", () => {
  const video = getYouTubeVideo(
    `https://youtu.be/${id}?t=1m30s&si=ignored&autoplay=1&origin=https://evil.test`,
  );
  const embed = new URL(video.embedUrl);
  assert.equal(Number(embed.searchParams.get("start")), 60 + 30);
  assert.equal(embed.searchParams.has("origin"), false);
  assert.equal(embed.searchParams.has("autoplay"), false);
  assert.equal(
    getYouTubeVideo(`https://youtu.be/${id}?t=-4`).embedUrl.includes("start="),
    false,
  );
});
test("arbitrary iframe origins, credentials, protocols and malformed YouTube IDs are rejected", () => {
  for (const input of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//youtube.com/watch?v=" + id,
    `http://youtu.be/${id}`,
    `https://youtu.be.evil.test/${id}`,
    `https://youtube.com.evil.test/watch?v=${id}`,
    `https://person@youtube.com/watch?v=${id}`,
    `https://youtube.com:8443/watch?v=${id}`,
    "https://youtu.be/invalid",
    "https://youtube.com/playlist?list=example",
    `https://youtu.be/${id}/extra`,
  ])
    assert.equal(getYouTubeVideo(input), null, input);
  assert.equal(
    lessonVideoSource("https://youtube.com/playlist?list=example").kind,
    "unsupported",
  );
  assert.equal(lessonVideoSource("javascript:alert(1)").kind, "unsupported");
  assert.equal(lessonVideoSource(""), null);
});
test("direct and private signed video links still use the native file player", () => {
  for (const input of [
    "https://cdn.example.com/lesson.mp4",
    "https://cdn.example.com:8443/lesson.webm",
    "https://example.supabase.co/storage/v1/object/sign/course-assets/course/video.mp4?token=test-fixture",
  ]) {
    assert.equal(lessonVideoSource(input).kind, "file");
    assert.equal(lessonVideoSource(input).url, input);
  }
});
