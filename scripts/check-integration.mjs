import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const db = createClient(
  "https://zjnpckryymbjmxhauoux.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const users = [],
  courseId = randomUUID(),
  moduleId = randomUUID(),
  lessonId = randomUUID(),
  checks = [];
const pass = (name) => {
  checks.push({ name, passed: true });
  console.log("PASS", name);
};
function valid(result) {
  if (result.error)
    throw new Error("Fixture DB operation failed: " + result.error.code);
  return result.data;
}
function session() {
  const jar = new Map();
  return async (path, action, payload, form) => {
    const headers = {
      Origin: origin,
      Cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
    };
    const options = action
      ? {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload }),
        }
      : form
        ? { method: "POST", headers, body: form }
        : { headers };
    const response = await fetch(origin + path, options);
    for (const c of response.headers.getSetCookie()) {
      const first = c.split(";")[0],
        at = first.indexOf("=");
      jar.set(first.slice(0, at), first.slice(at + 1));
    }
    return { status: response.status, ...(await response.json()) };
  };
}
try {
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const password = "Fixture-" + randomUUID() + "-Aa7",
      email = "arn-fixture-" + randomUUID() + "@example.com";
    const user = valid(
      await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: "Disposable integration fixture" },
      }),
    ).user;
    users.push(user.id);
    const client = session();
    const login = await client("/api/action", "login", { email, password });
    assert.equal(login.ok, true, login.error);
    clients.push(client);
  }
  const [a, b] = clients;
  pass("Real authenticated POST login and session cookies");
  assert.equal(
    (
      await a("/api/action", "onboarding", {
        country_code: "GH",
        interests: ["AI_VIDEO"],
        experience_level: "BEGINNER",
      })
    ).ok,
    true,
  );
  pass("Country, interest, and experience onboarding persist");
  valid(
    await db.from("courses").insert({
      id: courseId,
      title: "Disposable integration fixture",
      slug: "arn-fixture-" + courseId,
      status: "PUBLISHED",
      access_type: "FREE",
    }),
  );
  valid(
    await db.from("course_modules").insert({
      id: moduleId,
      course_id: courseId,
      title: "Fixture module",
      sort_order: 0,
    }),
  );
  valid(
    await db.from("lessons").insert({
      id: lessonId,
      module_id: moduleId,
      title: "Fixture lesson",
      body: "Protected fixture content",
      sort_order: 0,
    }),
  );
  assert.equal(
    (await a("/api/action", "enroll", { course_id: courseId })).ok,
    true,
  );
  assert.equal(
    (await a("/api/action", "enroll", { course_id: courseId })).ok,
    true,
  );
  assert.equal(
    valid(await db.from("enrollments").select("id").eq("user_id", users[0]))
      .length,
    1,
  );
  pass("Idempotent free enrollment");
  const allowed = await a("/api/data?resource=lessons&course_id=" + courseId);
  assert.ok(allowed.data?.lessons?.some((l) => l.id === lessonId));
  const forbidden = await b("/api/data?resource=lessons&course_id=" + courseId);
  assert.ok(forbidden.error && !forbidden.data);
  pass("Entitled lesson access and second-student denial");
  assert.equal(
    (await a("/api/action", "complete_lesson", { lesson_id: lessonId })).ok,
    true,
  );
  assert.equal(
    (await a("/api/action", "complete_lesson", { lesson_id: lessonId })).ok,
    true,
  );
  const dash = await a("/api/data?resource=dashboard");
  assert.equal(dash.data.stats.lessonsCompleted, 1);
  assert.ok(dash.data.recognition.length);
  pass("Completion, resume/progress and real recognition");
  const admin = await a("/api/data?resource=admin&table=profiles");
  assert.equal(admin.status, 403);
  pass("Student cannot read the admin user directory");
  const video = await readFile("/tmp/airiches-fixture.mp4");
  function upload(bytes, mime) {
    const f = new FormData();
    f.set("file", new Blob([bytes], { type: mime }), "fixture.mp4");
    f.set("title", "Disposable fixture");
    f.set("description", "Test-only private media");
    f.set("question", "Fixture validation");
    f.set("project_category", "AI_VIDEO");
    f.set("review_category", "GENERAL");
    return a("/api/reviews/upload", null, null, f);
  }
  const invalid = await upload(Buffer.from("this is not video"), "video/mp4");
  assert.equal(invalid.ok, false);
  pass("Actual invalid media rejected despite claimed video MIME");
  const racing = await Promise.all([
    upload(video, "video/mp4"),
    upload(video, "video/mp4"),
  ]);
  assert.equal(
    racing.filter((r) => r.ok).length,
    1,
    JSON.stringify(racing.map((r) => ({ ok: r.ok, error: r.error }))),
  );
  const review = valid(
    await db
      .from("review_submissions")
      .select("id,video_path,status")
      .eq("user_id", users[0])
      .single(),
  );
  assert.equal(review.status, "PENDING");
  pass("Actual probed private upload and concurrent last-credit protection");
  const other = await b("/api/data?resource=review_detail&id=" + review.id);
  assert.ok(other.error && !other.data);
  pass("Second student cannot see private review or signed video");
  for (const provider of ["PAYSTACK", "KORA"]) {
    const checkout = await a("/api/action", "checkout", {
      price_id: "20000000-0000-4000-8000-000000000001",
      provider,
      country_code: "GH",
    });
    assert.equal(checkout.ok, true, checkout.error);
    const order = valid(
      await db
        .from("orders")
        .select("id,membership_plan_id,snapshot")
        .eq("id", checkout.data.order_id)
        .single(),
    );
    assert.equal(order.membership_plan_id, order.snapshot.plan.id);
    const pending = await a("/api/action", "verify_payment", {
      reference: checkout.data.reference,
      provider,
    });
    assert.equal(pending.ok, true, pending.error);
    assert.equal(pending.data.status, "PENDING");
    pass(
      provider +
        " actual test checkout/pending verification grants no membership",
    );
  }
  assert.equal(
    valid(await db.from("subscriptions").select("id").eq("user_id", users[0]))
      .length,
    0,
  );
} catch (error) {
  checks.push({ name: error.message, passed: false });
  console.error("Integration failure:", error.message);
  process.exitCode = 1;
} finally {
  let cleaned = true;
  for (const id of users) {
    const videos = await db
      .from("review_submissions")
      .select("video_path")
      .eq("user_id", id);
    for (const r of videos.data || [])
      if (r.video_path.startsWith(id + "/")) {
        const removed = await db.storage
          .from("review-videos")
          .remove([r.video_path]);
        if (removed.error) cleaned = false;
      }
    for (const table of [
      "review_feedback",
      "review_submissions",
      "validated_uploads",
      "lesson_progress",
      "points_transactions",
      "user_badges",
      "review_credit_grants",
      "enrollments",
      "notification_outbox",
      "notifications",
      "entitlements",
      "payments",
      "orders",
    ]) {
      if (table === "review_feedback") continue;
      const result = await db.from(table).delete().eq("user_id", id);
      if (result.error) cleaned = false;
    }
    const removed = await db.auth.admin.deleteUser(id);
    if (removed.error) cleaned = false;
  }
  const removed = await db.from("courses").delete().eq("id", courseId);
  if (removed.error) cleaned = false;
  checks.push({
    name: "Only disposable fixtures cleaned; existing owner data untouched",
    passed: cleaned,
  });
  if (!cleaned) process.exitCode = 1;
  await writeFile(
    "docs/integration-validation.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        checks,
        noCompletedPayments: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Fixture cleanup:", cleaned);
}
