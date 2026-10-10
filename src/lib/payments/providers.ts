import { createHmac, timingSafeEqual } from "node:crypto";
export type Provider = "PAYSTACK" | "KORA";
export type CheckoutInput = {
  reference: string;
  amount: number;
  currency: string;
  minorUnits: number;
  email: string;
  name: string;
  returnUrl: string;
  webhookUrl: string;
  metadata: Record<string, string>;
  methods?: string[];
};
export type VerifiedPayment = {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  mode: string;
  provider_transaction_reference?: string;
};
export type VerifiedRefund = {
  reference: string;
  amount: number | string;
  currency: string;
  status: string;
  mode?: string;
  transaction_reference?: string;
  payment_reference?: string;
};
export function signatureEqual(expected: string, actual: string | null) {
  if (
    !actual ||
    !/^[a-fA-F0-9]+$/.test(actual) ||
    actual.length !== expected.length
  )
    return false;
  const a = Buffer.from(expected, "hex"),
    b = Buffer.from(actual, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export function verifySignature(
  provider: Provider,
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (provider === "PAYSTACK")
    return signatureEqual(
      createHmac("sha512", secret).update(raw).digest("hex"),
      signature,
    );
  try {
    const event = JSON.parse(raw);
    if (!event.data || typeof event.data !== "object") return false;
    return signatureEqual(
      createHmac("sha256", secret)
        .update(JSON.stringify(event.data))
        .digest("hex"),
      signature,
    );
  } catch {
    return false;
  }
}
export function majorToMinor(value: unknown, units: number) {
  const text = String(value);
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Invalid provider amount.");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > units && /[1-9]/.test(fraction.slice(units)))
    throw new Error("Invalid currency precision.");
  const minor =
    BigInt(whole) * 10n ** BigInt(units) +
    BigInt(
      (fraction.slice(0, units) + "0".repeat(units)).slice(0, units) || "0",
    );
  if (minor > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Amount exceeds supported range.");
  return Number(minor);
}
function externalReference(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return String(value);
  return undefined;
}
function transactionReference(value: unknown): string | undefined {
  if (value && typeof value === "object" && !Array.isArray(value))
    return externalReference((value as { id?: unknown }).id);
  return externalReference(value);
}
export function paymentReadiness() {
  return [
    {
      provider: "PAYSTACK",
      configured: Boolean(
        process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_"),
      ),
      mode: "test",
      automaticRenewal: false,
    },
    {
      provider: "KORA",
      configured: Boolean(process.env.KORA_SECRET_KEY?.startsWith("sk_test_")),
      mode: "test",
      automaticRenewal: false,
    },
  ];
}
function secretFor(provider: Provider) {
  const secret =
    provider === "PAYSTACK"
      ? process.env.PAYSTACK_SECRET_KEY
      : process.env.KORA_SECRET_KEY;
  if (!secret)
    throw new Error(
      "Payments are not available yet. The administrator needs to complete provider setup.",
    );
  // Live mode requires a separate explicit deployment configuration; never infer from key presence.
  if (
    !secret.startsWith("sk_test_") &&
    process.env.PAYMENTS_LIVE_ENABLED !== "true"
  )
    throw new Error("Only test-mode payment keys are currently enabled.");
  return secret;
}
async function request(url: string, secret: string, body?: unknown) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      "The payment provider could not complete that request. Please try again later.",
    );
  const data = await response.json();
  if (data.status !== true)
    throw new Error(
      "The payment provider did not accept the request. Please contact support.",
    );
  return data.data;
}
export function trustedCheckoutUrl(
  provider: Provider,
  value: unknown,
  testMode: boolean,
) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const allowed =
      provider === "PAYSTACK"
        ? ["https://checkout.paystack.com"]
        : testMode
          ? [
              "https://test-checkout.korapay.com",
              "https://checkout.korapay.com",
            ]
          : ["https://checkout.korapay.com"];
    return !url.username && !url.password && allowed.includes(url.origin);
  } catch {
    return false;
  }
}
export function providerAdapter(provider: Provider) {
  const secret = secretFor(provider);
  return {
    secret,
    async initialize(input: CheckoutInput) {
      if (provider === "PAYSTACK") {
        const data = await request(
          "https://api.paystack.co/transaction/initialize",
          secret,
          {
            email: input.email,
            amount: input.amount,
            currency: input.currency,
            reference: input.reference,
            callback_url: input.returnUrl,
            metadata: input.metadata,
            ...(input.methods?.length ? { channels: input.methods } : {}),
          },
        );
        if (
          data.reference !== input.reference ||
          !trustedCheckoutUrl(
            provider,
            data.authorization_url,
            secret.startsWith("sk_test_"),
          )
        )
          throw new Error(
            "The payment provider returned an invalid checkout link.",
          );
        return data.authorization_url as string;
      }
      const data = await request(
        "https://api.korapay.com/merchant/api/v1/charges/initialize",
        secret,
        {
          reference: input.reference,
          amount: input.amount / 10 ** input.minorUnits,
          currency: input.currency,
          customer: { name: input.name, email: input.email },
          redirect_url: input.returnUrl,
          notification_url: input.webhookUrl,
          metadata: input.metadata,
          ...(input.methods?.length ? { channels: input.methods } : {}),
        },
      );
      if (
        data.reference !== input.reference ||
        !trustedCheckoutUrl(
          provider,
          data.checkout_url,
          secret.startsWith("sk_test_"),
        )
      )
        throw new Error(
          "The payment provider returned an invalid checkout link.",
        );
      return data.checkout_url as string;
    },
    async verify(
      reference: string,
      minorUnits: number,
    ): Promise<VerifiedPayment> {
      const data = await request(
        provider === "PAYSTACK"
          ? `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`
          : `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(reference)}`,
        secret,
      );
      return {
        reference: data.reference,
        amount:
          provider === "PAYSTACK"
            ? Number(data.amount)
            : majorToMinor(data.amount, minorUnits),
        currency: data.currency,
        status: data.status,
        mode:
          data.domain ||
          data.mode ||
          (secret.startsWith("sk_test_") ? "test" : "live"),
        provider_transaction_reference:
          provider === "PAYSTACK"
            ? externalReference(data.id)
            : externalReference(data.payment_reference) ||
              externalReference(data.reference),
      };
    },
    async verifyRefund(
      refundId: string,
      minorUnits?: number,
    ): Promise<VerifiedRefund> {
      if (provider === "PAYSTACK") {
        const data = await request(
          `https://api.paystack.co/refund/${encodeURIComponent(refundId)}`,
          secret,
        );
        const returnedId = externalReference(data.id);
        if (!returnedId || returnedId !== refundId)
          throw new Error("The verified refund reference does not match.");
        return {
          reference: returnedId,
          amount: Number(data.amount),
          currency: data.currency,
          status: data.status,
          mode: data.domain,
          transaction_reference: transactionReference(data.transaction),
        };
      }
      const data = await request(
        `https://api.korapay.com/merchant/api/v1/refunds/${encodeURIComponent(refundId)}`,
        secret,
      );
      if (typeof data.reference !== "string" || data.reference !== refundId)
        throw new Error("The verified refund reference does not match.");
      return {
        reference: data.reference,
        amount:
          minorUnits === undefined
            ? data.amount
            : majorToMinor(data.amount, minorUnits),
        currency: data.currency,
        status: data.status,
        mode: data.mode || data.domain,
        payment_reference: externalReference(data.payment_reference),
      };
    },
  };
}
