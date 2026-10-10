import { NextRequest, NextResponse } from "next/server";
import {
  Provider,
  providerAdapter,
  verifySignature,
} from "@/lib/payments/providers";
import { verifyAndFulfill } from "@/server/commerce";
import { verifyAndRecordRefund } from "@/server/refunds";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const provider = (await params).provider.toUpperCase() as Provider;
  if (!["PAYSTACK", "KORA"].includes(provider))
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  try {
    if (Number(request.headers.get("content-length") || 0) > 100000)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 100000)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const adapter = providerAdapter(provider);
    const signature = request.headers.get(
      provider === "PAYSTACK" ? "x-paystack-signature" : "x-korapay-signature",
    );
    if (!verifySignature(provider, raw, signature, adapter.secret))
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    const event = JSON.parse(raw);
    const type =
      typeof event.event === "string" ? event.event : event.event?.type;
    if (type === "charge.success") {
      const reference = String(event.data?.reference || "");
      const result = await verifyAndFulfill(
        provider,
        reference,
        `${provider}:charge.success:${reference}`,
      );
      return NextResponse.json({ received: true, ...result });
    }
    const refundEvent =
      (provider === "PAYSTACK" && type === "refund.processed") ||
      (provider === "KORA" && type === "refund.success");
    if (!refundEvent)
      return NextResponse.json({ received: true, processed: false });
    const refundId =
      provider === "PAYSTACK" ? event.data?.id : event.data?.reference;
    if (
      (typeof refundId !== "string" && typeof refundId !== "number") ||
      String(refundId).length === 0
    )
      throw new Error("Invalid refund event reference.");
    const result = await verifyAndRecordRefund(provider, String(refundId));
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error(
      "payment_webhook_rejected",
      provider,
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Unable to verify event; retry later." },
      { status: 503 },
    );
  }
}
