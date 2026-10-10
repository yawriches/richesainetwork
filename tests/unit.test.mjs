import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  majorToMinor,
  verifySignature,
  signatureEqual,
  trustedCheckoutUrl,
  providerAdapter,
} from "../src/lib/payments/providers.ts";
import { money, safeResourceHref } from "../src/lib/ui.ts";
const key = "sk_test_UNIT_FIXTURE_NOT_A_REAL_KEY";
test("major/minor conversion is exact and rejects overprecision", () => {
  assert.equal(majorToMinor("75.00", 2), 7500);
  assert.equal(majorToMinor("0.01", 2), 1);
  assert.equal(majorToMinor("75", 0), 75);
  assert.equal(majorToMinor("1.2300", 2), 123);
  assert.throws(() => majorToMinor("1.234", 2));
  assert.throws(() => majorToMinor("-1", 2));
  assert.throws(() => majorToMinor("1e3", 2));
  assert.throws(() => majorToMinor("99999999999999999999", 2));
});
test("prices format stored minor units, not inflated raw integers", () => {
  assert.match(money(7500, "GHS", 2), /75\.00/);
  assert.match(money(75, "GHS", 0), /75/);
  assert.equal(money("bad", "GHS"), "Price shown at checkout");
  assert.equal(money(7500, "bad"), "Price shown at checkout");
});
test("Paystack signature covers exact raw bytes", () => {
  const raw = '{"event":"charge.success","data":{"reference":"fixture"}}';
  const signature = createHmac("sha512", key).update(raw).digest("hex");
  assert.equal(verifySignature("PAYSTACK", raw, signature, key), true);
  assert.equal(verifySignature("PAYSTACK", raw + " ", signature, key), false);
  assert.equal(verifySignature("PAYSTACK", raw, null, key), false);
});
test("Kora signature covers data only and rejects mutation", () => {
  const data = { reference: "fixture", amount: 75, currency: "GHS" },
    raw = JSON.stringify({ event: "charge.success", data });
  const signature = createHmac("sha256", key)
    .update(JSON.stringify(data))
    .digest("hex");
  assert.equal(verifySignature("KORA", raw, signature, key), true);
  assert.equal(
    verifySignature(
      "KORA",
      JSON.stringify({ data: { ...data, amount: 750 } }),
      signature,
      key,
    ),
    false,
  );
  assert.equal(verifySignature("KORA", "not-json", signature, key), false);
  assert.equal(verifySignature("KORA", "{}", signature, key), false);
});
test("malformed signature encodings never compare equal", () => {
  assert.equal(signatureEqual("ab".repeat(32), "zz".repeat(32)), false);
  assert.equal(signatureEqual("ab".repeat(32), "ab"), false);
  assert.equal(signatureEqual("ab".repeat(32), "AB".repeat(32)), true);
});
test("checkout redirects are exact allowed HTTPS origins", () => {
  assert.equal(
    trustedCheckoutUrl(
      "KORA",
      "https://test-checkout.korapay.com/fixture/pay",
      true,
    ),
    true,
  );
  assert.equal(
    trustedCheckoutUrl(
      "KORA",
      "https://test-checkout.korapay.com/fixture/pay",
      false,
    ),
    false,
  );
  assert.equal(
    trustedCheckoutUrl(
      "PAYSTACK",
      "https://checkout.paystack.com/fixture",
      true,
    ),
    true,
  );
  for (const url of [
    "https://checkout.paystack.com.evil.test/",
    "http://checkout.paystack.com/",
    "https://person@checkout.paystack.com/",
    "javascript:alert(1)",
    "https://checkout.paystack.com:8443/",
  ])
    assert.equal(trustedCheckoutUrl("PAYSTACK", url, true), false);
});
test("unsafe resource protocols are rejected", () => {
  assert.equal(safeResourceHref("javascript:alert(1)"), null);
  assert.equal(safeResourceHref("//evil.test"), null);
  assert.equal(safeResourceHref("data:text/html,test"), null);
  assert.equal(
    safeResourceHref("https://example.com/file"),
    "https://example.com/file",
  );
  assert.equal(safeResourceHref("/reviews"), "/reviews");
});
test("live secrets are rejected without explicit live authorization", () => {
  const before = process.env.PAYSTACK_SECRET_KEY,
    live = process.env.PAYMENTS_LIVE_ENABLED;
  try {
    process.env.PAYSTACK_SECRET_KEY = "sk_live_UNIT_FIXTURE";
    delete process.env.PAYMENTS_LIVE_ENABLED;
    assert.throws(() => providerAdapter("PAYSTACK"), /Only test-mode/);
  } finally {
    if (before === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = before;
    if (live === undefined) delete process.env.PAYMENTS_LIVE_ENABLED;
    else process.env.PAYMENTS_LIVE_ENABLED = live;
  }
});
