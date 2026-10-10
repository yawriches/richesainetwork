import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("managed Preview uses the stable Webpack development transport", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.match(packageJson.scripts.dev, /next dev --webpack/);
});

test("learner search routes a typed query to the existing courses catalogue", () => {
  const portal = read("src/components/portal.tsx");
  assert.match(portal, /className="portal-search"/);
  assert.match(portal, /aria-label="Search courses and resources"/);
  assert.match(portal, /\/courses\?search=\$\{encodeURIComponent\(value\)\}/);
  assert.doesNotMatch(portal, /<span>Search courses, resources\.\.\.<\/span>/);
});

test("native authentication fallback forwards Supabase session cookies on redirect", () => {
  const authRoute = read("src/app/api/auth/form/route.ts");
  const form = read("src/components/auth-forms.tsx");
  assert.match(authRoute, /copySetCookies/);
  assert.match(authRoute, /getSetCookie/);
  assert.match(authRoute, /copySetCookies\(response\.headers, redirect\.headers\)/);
  assert.match(form, /window\.location\.assign\(result\.data\?\.redirect \|\| "\/dashboard"\)/);
});

test("Riches AI public navigation has session-aware dashboard actions", () => {
  const site = read("src/components/site.tsx");
  assert.match(site, /getData\("me"\)/);
  assert.match(site, /signedIn \? "Dashboard" : "Get started"/);
  assert.match(site, /\["Mentorship", "\/mentorship"\]/);
  assert.doesNotMatch(site, /AI Marketplace/);
  assert.doesNotMatch(site, /AI Riches Network/);
});

test("community schema protects member images and supports social interactions", () => {
  const migration = read("supabase/migrations/20261007000100_member_community.sql");
  const fix = read("supabase/migrations/20261007000200_community_visibility_fix.sql");
  for (const table of ["community_posts", "community_comments", "community_reactions", "community_reports"])
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  assert.match(migration, /values \('community-media', 'community-media', false/);
  assert.match(migration, /alter table public\.community_posts enable row level security/);
  assert.match(migration, /community_posts_insert/);
  assert.match(migration, /community_reactions_insert/);
  assert.match(migration, /community_reports_insert/);
  assert.match(fix, /status = 'PUBLISHED'/);
});

test("community access rendering is safe before the access request resolves", () => {
  const portal = read("src/components/portal.tsx");
  assert.match(portal, /const access = state\.access \|\| \{\}/);
  assert.match(portal, /access\.membership_active/);
  assert.doesNotMatch(portal, /state\.access\.membership_active/);
});

test("community uploads are image-only, size-limited, and never return public URLs", () => {
  const upload = read("src/app/api/assets/upload/route.ts");
  assert.match(upload, /"community-media"/);
  assert.match(upload, /imageOnly = \["avatars", "course-thumbnails", "community-media"\]/);
  assert.match(upload, /GIF87a/);
  assert.match(upload, /bucket === "community-media"/);
  assert.match(upload, /const url = \["avatars", "course-thumbnails"\]/);
});

test("community is paid-member gated and quota checks are enforced in RLS", () => {
  const migration = read("supabase/migrations/20261007000300_community_management.sql");
  const hardening = read("supabase/migrations/20261007000400_community_policy_hardening.sql");
  const limits = read("supabase/migrations/20261007000500_community_limits_and_storage.sql");
  const atomic = read("supabase/migrations/20261007000600_community_atomic_moderation.sql");
  const dataRoute = read("src/app/api/data/route.ts");
  const actions = read("src/app/api/action/route.ts");
  assert.match(migration, /membership_required boolean not null default true/);
  assert.match(migration, /create or replace function public\.community_access/);
  assert.match(migration, /community_can_post/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /posts_per_day/);
  assert.match(migration, /community_posts_insert[\s\S]*community_can_post/);
  assert.match(dataRoute, /resource === "community_access"/);
  assert.match(dataRoute, /resource === "community_feed"[\s\S]*access\.can_access/);
  assert.match(actions, /community_settings_update/);
  assert.match(actions, /community_member_control/);
  assert.match(actions, /community_post_moderate/);
  assert.match(actions, /community_report_resolve/);
  assert.match(hardening, /community_posts_update[\s\S]*community_can_view/);
  assert.match(hardening, /community_comments_delete[\s\S]*community_can_view/);
  assert.match(limits, /community_media_owner_insert[\s\S]*community_can_post/);
  assert.match(atomic, /community_open_report_unique/);
  assert.match(atomic, /admin_community_moderate/);
});

test("admin community control center is wired into operations navigation", () => {
  const admin = read("src/components/admin.tsx");
  const control = read("src/components/admin-community.tsx");
  assert.match(admin, /CommunityControlCenter/);
  assert.match(admin, /ids: \["community",/);
  assert.match(control, /Community settings/);
  assert.match(control, /Suspend, restore, or ban access/);
  assert.match(control, /Recent moderation actions/);
});

test("community can be hidden everywhere without removing the admin kill switch", () => {
  const visibility = read("supabase/migrations/20261007000700_community_visibility_toggle.sql");
  const catalog = read("src/lib/catalog.ts");
  const dataRoute = read("src/app/api/data/route.ts");
  const site = read("src/app/(public)/page.tsx");
  const portal = read("src/components/portal.tsx");
  const admin = read("src/components/admin-community.tsx");
  assert.match(visibility, /community_is_enabled/);
  assert.match(visibility, /grant execute on function public\.community_is_enabled\(\) to anon/);
  assert.match(catalog, /resource === "community_enabled"/);
  assert.match(dataRoute, /community_enabled: enabled !== false/);
  assert.match(site, /communityEnabled && <section className="section">/);
  assert.match(portal, /communityEnabled \|\| n\.href !== "\/community"/);
  assert.match(portal, /Boolean\(community\.data\?\.community_enabled\)/);
  assert.match(portal, /access\.reason === "COMMUNITY_DISABLED"/);
  assert.match(portal, /communityEnabled && <section className="card dashboard-mentor-card">/);
  assert.match(admin, /Community visible to members/);
  assert.match(admin, /hide the community from learner navigation/);
});

test("AI support preparation keeps protected retrieval authorization-aware", () => {
  const brief = read("docs/AI-SUPPORT-AGENT-PLAN.md");
  assert.match(brief, /Before retrieving protected course lessons/);
  assert.match(brief, /Public \| Approved/);
  assert.match(brief, /Signed-in learner/);
  assert.match(brief, /Administrator \| Operational/);
  assert.match(brief, /prompt injection/);
  assert.match(brief, /WhatsApp/);
});

test("mentorship replaces the marketplace in the route manifest", () => {
  const manifest = JSON.parse(read("public/manus-routes.json"));
  assert.ok(manifest.routes.some((route) => route.path === "/mentorship"));
  assert.ok(!manifest.routes.some((route) => route.path === "/marketplace"));
});

test("six-week mentorship applications are private and administrator-reviewed", () => {
  const migration = read("supabase/migrations/20261008000100_ai_income_mentorship.sql");
  const actions = read("src/app/api/action/route.ts");
  const dataRoute = read("src/app/api/data/route.ts");
  const admin = read("src/components/admin-mentorship.tsx");
  assert.match(migration, /create table if not exists public\.mentorship_applications/);
  assert.match(migration, /mentorship_application_events/);
  assert.match(migration, /enable row level security/);
  assert.match(actions, /mentorship_application_submit/);
  assert.match(actions, /mentorship_application_update/);
  assert.match(dataRoute, /resource === "admin_mentorship"/);
  assert.match(admin, /never creates an order or confirms a place automatically/);
});
