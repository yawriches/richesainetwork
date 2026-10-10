import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { providerAdapter } from "../src/lib/payments/providers.ts";
const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const results = [];
for (const provider of ["PAYSTACK", "KORA"]) {
  const key =
    process.env[
      provider === "PAYSTACK" ? "PAYSTACK_SECRET_KEY" : "KORA_SECRET_KEY"
    ];
  if (!key?.startsWith("sk_test_"))
    throw new Error("This check requires test keys only.");
  try {
    const url = await providerAdapter(provider).initialize({
      reference: `arn-${randomUUID()}`,
      amount: 7500,
      currency: "GHS",
      minorUnits: 2,
      email: "validation@example.com",
      name: "Test-only integration validation",
      returnUrl: origin + "/payment/return",
      webhookUrl: origin + "/api/webhooks/" + provider.toLowerCase(),
      metadata: { "validation-only": "no-purchase-no-entitlement" },
      methods: ["mobile_money"],
    });
    results.push({
      provider,
      currency: "GHS",
      mode: "TEST",
      initializationPassed: true,
      host: new URL(url).hostname,
      completedPayment: false,
    });
  } catch (error) {
    results.push({
      provider,
      currency: "GHS",
      mode: "TEST",
      initializationPassed: false,
      error: error.message,
      completedPayment: false,
    });
    process.exitCode = 1;
  }
}
await writeFile(
  "docs/provider-validation.json",
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) +
    "\n",
);
console.log(results);
