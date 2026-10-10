import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Bunny video schema keeps community records private and quota-enforced", () => {
  const migration = read("supabase/migrations/20261008000200_bunny_community_videos.sql");
  assert.match(migration, /create table if not exists public\.community_videos/);
  assert.match(migration, /video_enabled boolean not null default true/);
  assert.match(migration, /video_posts_per_day integer not null default 1/);
  assert.match(migration, /max_video_upload_mb integer not null default 250/);
  assert.match(migration, /max_video_duration_seconds integer not null default 180/);
  assert.match(migration, /alter table public\.community_videos enable row level security/);
  assert.match(migration, /revoke all on public\.community_videos from anon, authenticated/);
  assert.match(migration, /community_video_reserve/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /HIDE_VIDEO.*RESTORE_VIDEO.*DELETE_VIDEO/s);
});

test("Bunny integration keeps keys server-only and signs the official direct-upload and embed contracts", () => {
  const bunny = read("src/server/bunny-stream.ts");
  const upload = read("src/app/api/community/videos/upload/route.ts");
  const webhook = read("src/app/api/webhooks/bunny-stream/route.ts");
  assert.match(bunny, /createHash\("sha256"\)/);
  assert.match(bunny, /\$\{libraryId\}\$\{apiKey\}\$\{expiresAt\}\$\{videoId\}/);
  assert.match(bunny, /player\.mediadelivery\.net\/embed/);
  assert.match(upload, /identity\(\)/);
  assert.match(upload, /community_video_reserve/);
  assert.match(upload, /createBunnyUploadCredentials/);
  assert.match(webhook, /x-bunnystream-signature-version/);
  assert.match(webhook, /timingSafeEqual/);
  assert.match(webhook, /await request\.text\(\)/);
  assert.doesNotMatch(upload, /BUNNY_STREAM_API_KEY/);
});

test("community composer uploads directly through Bunny TUS and only posts ready video drafts", () => {
  const portal = read("src/components/portal.tsx");
  const actions = read("src/app/api/action/route.ts");
  const data = read("src/app/api/data/route.ts");
  const transport = read("src/lib/bunny-upload.ts");
  assert.match(transport, /AuthorizationSignature/);
  assert.match(transport, /Upload-Length/);
  assert.match(transport, /await remoteOffset\(\)/);
  assert.match(portal, /videoDraft\.status !== "READY"/);
  assert.match(portal, /await uploadCommunityVideo\(file, uploadInfo/);
  assert.match(portal, /community_video_discard/);
  assert.match(actions, /community_post_create[\s\S]*video_id/);
  assert.match(actions, /community_video_finalize/);
  assert.match(portal, /community_video_discard/);
  assert.match(portal, /window\.setInterval\(refresh, 8000\)/);
  assert.match(portal, /getData\("community_video_drafts"\)/);
  assert.match(portal, /postAction\("community_video_finalize"/);
  assert.match(portal, /URL\.createObjectURL/);
  assert.match(portal, /community-video-preview-placeholder/);
  assert.match(portal, /community-video-chip-status/);
  assert.match(portal, /autoPlay muted loop playsInline/);
  assert.match(portal, /community-upload-progress/);
  assert.match(data, /resource === "community_video_drafts"/);
  assert.match(data, /reconcileCommunityVideo/);
  assert.match(data, /signedBunnyEmbedUrl/);
});

test("Bunny status is authoritative; no in-flight 90-second timeout and documented codes are mapped", () => {
  const reconciler = read("src/server/community-video-status.ts");
  const states = read("src/server/bunny-stream.ts");
  assert.match(reconciler, /reconcileCommunityVideo/);
  assert.match(reconciler, /record\.upload_expires_at/);
  assert.doesNotMatch(reconciler, /90_000/);
  assert.match(states, /\[3, 4, 9, 10\]/);
  assert.match(states, /\[5, 8\]/);
});

test("community mobile media controls contain long filenames and keep comments usable", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /\.community-video-chip \{[\s\S]*min-width: 0;[\s\S]*flex: 1 1 100%/);
  assert.match(css, /\.community-composer-actions \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.community-comment-form input \{[\s\S]*min-height: 50px/);
});

test("administrator community console exposes bounded Bunny video controls and moderation", () => {
  const admin = read("src/components/admin-community.tsx");
  assert.match(admin, /Community video enabled/);
  assert.match(admin, /Video uploads per member \/ day/);
  assert.match(admin, /Recent video uploads/);
  assert.match(admin, /community_video_moderate/);
  assert.match(admin, /Delete removes the Bunny asset/);
});
