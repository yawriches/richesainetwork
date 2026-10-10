import "server-only";
import { randomUUID } from "node:crypto";
import { providerAdapter, Provider } from "@/lib/payments/providers";
import { PREVIEW_ORIGIN, serviceClient } from "@/lib/supabase/server";
import { checked } from "./http";
export async function checkout(session: any, payload: any) {
  const { db, user, profile } = session;
  const provider = String(payload.provider || "").toUpperCase() as Provider;
  if (!["PAYSTACK", "KORA"].includes(provider))
    throw new Error("Choose an available payment provider.");
  const adapter = providerAdapter(provider);
  const service = serviceClient();
  const price = checked(
    await db
      .from("product_prices")
      .select("*")
      .eq("id", payload.price_id)
      .eq("status", "ACTIVE")
      .single(),
  );
  const now = new Date();
  if (
    (price.starts_at && new Date(price.starts_at) > now) ||
    (price.ends_at && new Date(price.ends_at) <= now)
  )
    throw new Error("This price is not currently available.");
  const product = checked(
    await db
      .from("products")
      .select("id,name,type,status,review_credit_quantity")
      .eq("id", price.product_id)
      .eq("status", "ACTIVE")
      .single(),
  );
  const countryCode = profile.country_code;
  if (
    !countryCode ||
    (payload.country_code && payload.country_code !== countryCode)
  )
    throw new Error("Set your account country before making a purchase.");
  const country = checked(
    await db
      .from("countries")
      .select("code,currency_code,active")
      .eq("code", countryCode)
      .eq("active", true)
      .single(),
  );
  if (price.country_code && price.country_code !== country.code)
    throw new Error("This pricing option is not available in your country.");
  if (price.currency !== country.currency_code)
    throw new Error("No eligible price is configured for your country yet.");
  const providerConfig = checked(
    await service
      .from("payment_providers")
      .select("*")
      .eq("code", provider)
      .eq("enabled", true)
      .single(),
  );
  if (providerConfig.mode !== "TEST")
    throw new Error(
      "Only test checkout is enabled until the live provider lifecycle is approved.",
    );
  if (
    !Array.isArray(providerConfig.countries) ||
    !providerConfig.countries.includes(country.code) ||
    !Array.isArray(providerConfig.currencies) ||
    !providerConfig.currencies.includes(price.currency)
  )
    throw new Error(
      "This provider is not available for that country and currency.",
    );
  const currency = checked(
    await db
      .from("currencies")
      .select("minor_units")
      .eq("code", price.currency)
      .single(),
  );
  if (!Number.isSafeInteger(Number(price.amount)) || Number(price.amount) <= 0)
    throw new Error("This price cannot be used for checkout.");
  const metadata: Record<string, string> = {};
  let plan = null;
  if (product.type === "MEMBERSHIP") {
    plan = checked(
      await db
        .from("membership_plans")
        .select("*")
        .eq("product_id", product.id)
        .eq("price_id", price.id)
        .eq("status", "ACTIVE")
        .single(),
    );
    if (
      !plan.countries.includes(country.code) ||
      !plan.providers.includes(provider)
    )
      throw new Error(
        "This membership plan is not available for the selected provider and country.",
      );
  }
  if (product.type === "SUPPORT") {
    const holdId = payload.metadata?.hold_id;
    const hold = checked(
      await service
        .from("booking_holds")
        .select("*")
        .eq("id", holdId)
        .eq("user_id", user.id)
        .is("order_id", null)
        .gt("expires_at", now.toISOString())
        .single(),
    );
    const availability = checked(
      await service
        .from("availability")
        .select("id,package_id")
        .eq("id", hold.availability_id)
        .single(),
    );
    const pack = checked(
      await service
        .from("support_packages")
        .select("id,product_id,price_id")
        .eq("id", availability.package_id)
        .single(),
    );
    if (pack.product_id !== product.id || pack.price_id !== price.id)
      throw new Error("The selected session does not match this package.");
    metadata.hold_id = hold.id;
  }
  const reference = `arn-${randomUUID()}`;
  const snapshot = {
    price,
    product,
    plan,
    minor_units: currency.minor_units,
    renewal_mode: "MANUAL",
  };
  const order = checked(
    await service
      .from("orders")
      .insert({
        user_id: user.id,
        price_id: price.id,
        product_id: product.id,
        membership_plan_id: plan?.id || null,
        amount: price.amount,
        currency: price.currency,
        provider,
        reference,
        status: "PENDING",
        country_code: country.code,
        metadata,
        snapshot,
      })
      .select("id")
      .single(),
  );
  if (metadata.hold_id)
    checked(
      await service
        .from("booking_holds")
        .update({ order_id: order.id })
        .eq("id", metadata.hold_id)
        .eq("user_id", user.id)
        .is("order_id", null)
        .select("id")
        .single(),
    );
  const origin = process.env.APP_ORIGIN || PREVIEW_ORIGIN;
  try {
    const url = await adapter.initialize({
      reference,
      amount: Number(price.amount),
      currency: price.currency,
      minorUnits: currency.minor_units,
      email: user.email!,
      name: profile.name || "Riches AI learner",
      // Include our own reference so the return page works for every provider,
      // including ones that do not append it to the redirect.
      returnUrl: `${origin}/payment/return?reference=${encodeURIComponent(reference)}`,
      webhookUrl: `${origin}/api/webhooks/${provider.toLowerCase()}`,
      metadata: { "order-id": order.id },
      methods: providerConfig.methods,
    });
    return {
      order_id: order.id,
      reference,
      url,
      checkout_url: url,
      renewal_mode: "MANUAL",
    };
  } catch (error) {
    await service
      .from("orders")
      .update({ status: "FAILED" })
      .eq("id", order.id)
      .eq("status", "PENDING");
    throw error;
  }
}
export async function verifyAndFulfill(
  provider: Provider,
  reference: string,
  eventKey: string,
) {
  if (!/^arn-[a-f0-9-]{36}$/.test(reference))
    throw new Error("Invalid transaction reference.");
  const service = serviceClient();
  const order = checked(
    await service
      .from("orders")
      .select(
        "id,user_id,provider,reference,amount,currency,status,snapshot,fulfillment_status",
      )
      .eq("reference", reference)
      .eq("provider", provider)
      .single(),
  );
  if (order.status === "REFUNDED")
    return { status: "REFUNDED", order_id: order.id };
  const payment = await providerAdapter(provider).verify(
    reference,
    Number(order.snapshot?.minor_units ?? 2),
  );
  if (payment.reference !== reference)
    throw new Error("The verified payment does not match the order.");
  if (payment.mode !== "test" && process.env.PAYMENTS_LIVE_ENABLED !== "true")
    throw new Error("Live payments are not enabled.");
  const providerStatus = String(payment.status || "").toLowerCase();
  if (providerStatus === "success") {
    if (
      payment.amount !== Number(order.amount) ||
      payment.currency !== order.currency
    )
      throw new Error("The verified payment does not match the order.");
    let fulfillmentStatus =
      order.fulfillment_status === "REQUIRES_ACTION"
        ? "REQUIRES_ACTION"
        : "SUCCESS";
    const fulfilled = await service.rpc("fulfill_order", {
      p_order_id: order.id,
      p_provider: provider,
      p_reference: reference,
      p_amount: payment.amount,
      p_currency: payment.currency,
      p_event_key: eventKey,
    });
    if (fulfilled.error) {
      checked(
        await service.rpc("record_paid_exception", {
          p_order_id: order.id,
          p_provider: provider,
          p_reference: reference,
          p_amount: payment.amount,
          p_currency: payment.currency,
          p_reason:
            "Provider payment verified; automatic fulfillment needs administrator resolution.",
        }),
      );
      fulfillmentStatus = "REQUIRES_ACTION";
    }
    if (payment.provider_transaction_reference) {
      checked(
        await service
          .from("payments")
          .update({
            provider_transaction_reference:
              payment.provider_transaction_reference,
          })
          .eq("order_id", order.id)
          .eq("provider", provider)
          .eq("reference", reference)
          .eq("status", "SUCCESS")
          .select("id")
          .single(),
      );
    }
    return { status: fulfillmentStatus, order_id: order.id };
  }

  const failureStatus =
    providerStatus === "failed"
      ? "FAILED"
      : providerStatus === "cancelled" || providerStatus === "canceled"
        ? "CANCELLED"
        : null;
  if (failureStatus) {
    const recorded = checked(
      await service.rpc("record_payment_failure", {
        p_order_id: order.id,
        p_provider: provider,
        p_reference: reference,
        p_status: providerStatus,
      }),
    );
    if (!recorded) {
      const current = checked(
        await service
          .from("orders")
          .select("status")
          .eq("id", order.id)
          .single(),
      );
      return { status: current.status, order_id: order.id };
    }
    return { status: failureStatus, order_id: order.id };
  }
  return { status: "PENDING", order_id: order.id };
}
