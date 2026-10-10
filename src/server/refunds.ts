import "server-only";
import {
  majorToMinor,
  Provider,
  providerAdapter,
  VerifiedRefund,
} from "@/lib/payments/providers";
import { serviceClient } from "@/lib/supabase/server";
import { checked } from "./http";

const ARN_REFERENCE = /^arn-[a-f0-9-]{36}$/;

type RefundOrder = {
  id: string;
  provider: Provider;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  snapshot: { minor_units?: number } | null;
};

function unitsFor(order: RefundOrder) {
  const units = Number(order.snapshot?.minor_units);
  if (!Number.isSafeInteger(units) || units < 0 || units > 6)
    throw new Error("The order currency precision is invalid.");
  return units;
}

async function loadOrderById(
  service: ReturnType<typeof serviceClient>,
  id: string,
  provider: Provider,
): Promise<RefundOrder> {
  return checked(
    await service
      .from("orders")
      .select("id,provider,reference,amount,currency,status,snapshot")
      .eq("id", id)
      .eq("provider", provider)
      .single(),
  ) as RefundOrder;
}

async function resolveOrder(
  provider: Provider,
  originalOrderReference: string | undefined,
  refund: VerifiedRefund,
): Promise<RefundOrder> {
  const service = serviceClient();
  if (originalOrderReference !== undefined) {
    if (!ARN_REFERENCE.test(originalOrderReference))
      throw new Error("Invalid original transaction reference.");
    return checked(
      await service
        .from("orders")
        .select("id,provider,reference,amount,currency,status,snapshot")
        .eq("reference", originalOrderReference)
        .eq("provider", provider)
        .single(),
    ) as RefundOrder;
  }

  const candidateIds = new Set<string>();
  const providerReference =
    provider === "PAYSTACK"
      ? refund.transaction_reference
      : refund.payment_reference;
  if (!providerReference)
    throw new Error("The refund cannot be matched to a verified transaction.");

  const payments = checked(
    await service
      .from("payments")
      .select("order_id")
      .eq("provider", provider)
      .eq("provider_transaction_reference", providerReference),
  ) as Array<{ order_id: string }>;
  for (const payment of payments || []) candidateIds.add(payment.order_id);

  // Kora may identify the original charge directly by the AI Riches ARN reference.
  if (provider === "KORA" && ARN_REFERENCE.test(providerReference)) {
    const directOrder = checked(
      await service
        .from("orders")
        .select("id")
        .eq("provider", provider)
        .eq("reference", providerReference)
        .maybeSingle(),
    ) as { id: string } | null;
    if (directOrder?.id) candidateIds.add(directOrder.id);
  }

  if (candidateIds.size !== 1)
    throw new Error("The refund does not identify exactly one paid order.");
  return loadOrderById(service, [...candidateIds][0], provider);
}

/**
 * Read-only provider verification followed by the service-only, idempotent
 * record_verified_refund RPC. This never initiates, retries, or cancels refunds.
 */
export async function verifyAndRecordRefund(
  provider: Provider,
  refundId: string,
  originalOrderReference?: string,
) {
  if (provider !== "PAYSTACK" && provider !== "KORA")
    throw new Error("Unknown payment provider.");
  if (typeof refundId !== "string" || !refundId || refundId.length > 200)
    throw new Error("Invalid refund reference.");

  const adapter = providerAdapter(provider);
  // Refund reconciliation is deliberately TEST-only, even if live charging is
  // separately enabled by a deployment-level override.
  if (!adapter.secret.startsWith("sk_test_"))
    throw new Error("Refund verification is available only in test mode.");

  // First fetch the refund, so webhook processing can associate it using only
  // provider transaction identifiers and trusted order/payment rows.
  const refund = await adapter.verifyRefund(refundId);
  if (refund.reference !== refundId)
    throw new Error("The verified refund reference does not match.");
  const completed =
    provider === "PAYSTACK"
      ? refund.status === "processed"
      : refund.status === "success";
  if (!completed) return { status: "PENDING" as const };
  if (
    (provider === "PAYSTACK" && refund.mode !== "test") ||
    (refund.mode !== undefined && refund.mode !== "test")
  )
    throw new Error("The verified refund is not in test mode.");
  if (typeof refund.currency !== "string" || !refund.currency)
    throw new Error("The verified refund currency is invalid.");

  const order = await resolveOrder(provider, originalOrderReference, refund);
  if (!ARN_REFERENCE.test(order.reference))
    throw new Error("The original transaction reference is invalid.");
  if (order.status !== "SUCCESS" && order.status !== "REFUNDED")
    throw new Error("Only a paid order can be reconciled as refunded.");
  const minorUnits = unitsFor(order);
  const amount =
    provider === "PAYSTACK"
      ? Number(refund.amount)
      : majorToMinor(refund.amount, minorUnits);
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("The verified refund amount is invalid.");
  const original = await adapter.verify(order.reference, minorUnits);
  if (
    original.reference !== order.reference ||
    original.status !== "success" ||
    original.mode !== "test" ||
    original.amount !== Number(order.amount) ||
    original.currency !== order.currency ||
    refund.currency !== original.currency ||
    amount > original.amount
  )
    throw new Error("The original transaction does not match the refund.");

  if (provider === "PAYSTACK") {
    if (
      !refund.transaction_reference ||
      !original.provider_transaction_reference ||
      refund.transaction_reference !== original.provider_transaction_reference
    )
      throw new Error("The refund does not match the original transaction.");
  } else if (
    !refund.payment_reference ||
    (refund.payment_reference !== original.reference &&
      refund.payment_reference !== original.provider_transaction_reference)
  ) {
    throw new Error("The refund does not match the original transaction.");
  }

  return checked(
    await serviceClient().rpc("record_verified_refund", {
      p_order_id: order.id,
      p_provider: provider,
      p_refund_id: refund.reference,
      p_amount: amount,
      p_currency: refund.currency,
    }),
  );
}
