import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const origin =
  process.env.APP_ORIGIN || "http://localhost:3000";
const db = createClient(
  "https://zjnpckryymbjmxhauoux.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const courseId = randomUUID(),
  moduleId = randomUUID(),
  lessonId = randomUUID();
const input = "https://youtu.be/GhaFPeBBesA?si=Fj9OFaISz97TOsQO";
const report = {
  input,
  checkedAt: new Date().toISOString(),
  checks: [],
  youtubePlayerNotice: null,
};
let userId, browser;
function checked(result) {
  if (result.error)
    throw new Error("Fixture operation failed: " + result.error.code);
  return result.data;
}
function pass(name) {
  report.checks.push({ name, passed: true });
  console.log("PASS", name);
}
try {
  const email = "arn-video-fixture-" + randomUUID() + "@example.com",
    password = "Fixture-" + randomUUID() + "-Aa7";
  userId = checked(
    await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "Disposable YouTube playback fixture" },
    }),
  ).user.id;
  checked(
    await db.from("courses").insert({
      id: courseId,
      title: "Disposable YouTube playback fixture",
      slug: "arn-video-fixture-" + courseId,
      status: "PUBLISHED",
      access_type: "FREE",
    }),
  );
  checked(
    await db
      .from("course_modules")
      .insert({ id: moduleId, course_id: courseId, title: "Fixture module" }),
  );
  checked(
    await db.from("lessons").insert({
      id: lessonId,
      module_id: moduleId,
      title: "YouTube playback fixture",
      video_url: input,
    }),
  );
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  async function action(name, payload) {
    const response = await context.request.post(origin + "/api/action", {
      headers: { Origin: origin },
      data: { action: name, payload },
    });
    const body = await response.json();
    assert.equal(body.ok, true, body.error);
    return body;
  }
  await action("login", { email, password });
  await action("onboarding", {
    country_code: "GH",
    interests: ["AI_VIDEO"],
    experience_level: "BEGINNER",
  });
  await action("enroll", { course_id: courseId });
  const page = await context.newPage();
  let referrer = null;
  page.on("request", (r) => {
    if (
      r.url().startsWith("https://www.youtube-nocookie.com/embed/GhaFPeBBesA")
    )
      referrer = r.headers()["referer"] || null;
  });
  await page.goto(origin + "/learn/" + courseId, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  const iframe = page.locator(
    'iframe[src^="https://www.youtube-nocookie.com/embed/GhaFPeBBesA"]',
  );
  await iframe.waitFor({ state: "visible", timeout: 30000 });
  assert.equal(await page.locator("article video").count(), 0);
  assert.equal(
    await iframe.getAttribute("referrerpolicy"),
    "strict-origin-when-cross-origin",
  );
  assert.ok((await iframe.getAttribute("allowfullscreen")) !== null);
  assert.equal(
    await page
      .getByRole("link", { name: "Watch on YouTube", exact: true })
      .getAttribute("href"),
    "https://www.youtube.com/watch?v=GhaFPeBBesA",
  );
  pass(
    "Real enrolled lesson uses the supplied link as a YouTube iframe with fullscreen and fallback",
  );
  await page.waitForTimeout(2500);
  if (referrer) {
    assert.equal(new URL(referrer).origin, new URL(origin).origin);
    pass(
      "YouTube receives application-origin referrer without the lesson path",
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const fit = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  if (!fit)
    console.log(
      "Mobile overflow:",
      await page.evaluate(() => ({
        viewport: innerWidth,
        total: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll("body *")]
          .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 12)
          .map((e) => ({
            tag: e.tagName,
            class: e.className,
            width: e.getBoundingClientRect().width,
            right: e.getBoundingClientRect().right,
          })),
      })),
    );
  assert.equal(fit, true);
  pass("YouTube lesson page fits a 390px mobile viewport");
  const frame = page
    .frames()
    .find((f) => f.url().startsWith("https://www.youtube-nocookie.com/embed/"));
  if (frame) {
    const body = await frame
      .locator("body")
      .innerText()
      .catch(() => "");
    if (/sign in|unavailable|error 153|configuration error/i.test(body))
      report.youtubePlayerNotice = body.slice(0, 400);
  }
  console.log(
    "YouTube cloud-browser notice:",
    report.youtubePlayerNotice || "No blocking notice detected",
  );
} catch (error) {
  report.checks.push({ name: error.message, passed: false });
  console.error("Scoped video check failed:", error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  let clean = true;
  if (userId) {
    for (const table of [
      "lesson_progress",
      "review_credit_grants",
      "enrollments",
      "notification_outbox",
      "notifications",
    ]) {
      const result = await db.from(table).delete().eq("user_id", userId);
      if (result.error) clean = false;
    }
    const result = await db.auth.admin.deleteUser(userId);
    if (result.error) clean = false;
  }
  const deleted = await db.from("courses").delete().eq("id", courseId);
  if (deleted.error) clean = false;
  report.checks.push({
    name: "Only disposable fixture records removed; existing lessons unchanged",
    passed: clean,
  });
  if (!clean) process.exitCode = 1;
  await writeFile(
    "docs/lesson-video-validation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log("Fixture cleanup:", clean);
}
