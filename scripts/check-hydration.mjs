import { chromium } from "playwright-core";
const origin =
  process.env.APP_ORIGIN || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 300)));
  page.on("requestfailed", (r) =>
    errors.push(
      `Request failed ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`,
    ),
  );
  await page.goto(origin + "/register", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(1200);
  const state = await page.locator("form").evaluate((form) => {
    const key = Object.keys(form).find((k) => k.startsWith("__reactProps"));
    return {
      method: form.method,
      handler: typeof form[key]?.onSubmit === "function",
    };
  });
  console.log("Registration state:", state, "JavaScript errors:", errors);
  await page.locator("#name").fill("Validation Test");
  await page.locator("#email").fill("validation@example.test");
  await page.locator("#password").fill("TEST_ONLY_NOT_REAL_1");
  await page.locator("#confirm_password").fill("TEST_ONLY_NOT_REAL_2");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForTimeout(500);
  const body = await page.locator("body").innerText();
  const accepted =
    state.method === "post" &&
    body.includes("passwords") &&
    !new URL(page.url()).search.includes("password");
  console.log("Safe invalid registration:", accepted);
  if (!accepted || !state.handler) process.exitCode = 1;
} finally {
  await browser.close();
}
