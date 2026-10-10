import { createClient } from "@supabase/supabase-js";

type Candidate = { submission_id: string; video_path: string };
const edge = (
  globalThis as unknown as {
    Deno: {
      env: { get(key: string): string | undefined };
      serve(handler: (request: Request) => Promise<Response>): void;
    };
  }
).Deno;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIDEO_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](mp4|webm|mov)$/i;

async function reconcilePayments(db: any) {
  const counts = {
    checked: 0,
    fulfilled: 0,
    failed: 0,
    pending: 0,
    blocked: 0,
    requires_action: 0,
  };
  const credentials = await db.rpc("native_test_payment_keys");
  if (credentials.error) return { ...counts, configured: false };
  const batch = await db
    .from("orders")
    .select("id,reference,provider,amount,currency,snapshot")
    .eq("status", "PENDING")
    .lt("created_at", new Date(Date.now() - 120000).toISOString())
    .order("created_at")
    .limit(10);
  if (batch.error) return { ...counts, configured: true, batch_error: true };
  await Promise.all(
    (batch.data || []).map(async (o: any) => {
      const key = credentials.data?.[o.provider];
      if (
        typeof key !== "string" ||
        !key.startsWith("sk_test_") ||
        !/^arn-[a-f0-9-]{36}$/.test(o.reference || "")
      ) {
        counts.blocked++;
        return;
      }
      try {
        const endpoint =
          o.provider === "PAYSTACK"
            ? `https://api.paystack.co/transaction/verify/${encodeURIComponent(o.reference)}`
            : `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(o.reference)}`;
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        const result = await response.json();
        counts.checked++;
        if (!response.ok || !result.status || !result.data) {
          counts.pending++;
          return;
        }
        const p = result.data,
          mode = p.domain || p.environment || p.mode;
        if (p.reference !== o.reference || mode !== "test") {
          counts.blocked++;
          return;
        }
        if (["failed", "cancelled", "canceled"].includes(p.status)) {
          const done = await db.rpc("record_payment_failure", {
            p_order_id: o.id,
            p_provider: o.provider,
            p_reference: o.reference,
            p_status: p.status,
          });
          if (done.error) counts.blocked++;
          else counts.failed++;
          return;
        }
        if (p.status !== "success") {
          counts.pending++;
          return;
        }
        let amount: number;
        if (o.provider === "PAYSTACK") amount = Number(p.amount);
        else {
          const units = Number(o.snapshot?.minor_units);
          const text = String(p.amount),
            match = text.match(/^(\d+)(?:\.(\d+))?$/);
          if (!match || !Number.isInteger(units) || units < 0 || units > 4)
            throw new Error("Invalid precision");
          const fraction = match[2] || "";
          if (fraction.slice(units).replace(/0/g, ""))
            throw new Error("Invalid precision");
          amount = Number(
            BigInt(match[1]) * 10n ** BigInt(units) +
              BigInt(
                (fraction.slice(0, units) + "0".repeat(units)).slice(
                  0,
                  units,
                ) || "0",
              ),
          );
        }
        if (
          !Number.isSafeInteger(amount) ||
          amount !== o.amount ||
          p.currency !== o.currency
        ) {
          counts.blocked++;
          return;
        }
        const done = await db.rpc("fulfill_order", {
          p_order_id: o.id,
          p_provider: o.provider,
          p_reference: o.reference,
          p_amount: amount,
          p_currency: p.currency,
          p_event_key: `reconcile:${o.provider}:${o.reference}`,
        });
        if (done.error) {
          const issue = await db.rpc("record_paid_exception", {
            p_order_id: o.id,
            p_provider: o.provider,
            p_reference: o.reference,
            p_amount: amount,
            p_currency: p.currency,
            p_reason:
              "Verified payment could not be automatically fulfilled; administrator resolution required.",
          });
          if (issue.error) {
            counts.blocked++;
            return;
          }
          counts.requires_action++;
        } else counts.fulfilled++;
        await db
          .from("payments")
          .update({
            provider_transaction_reference: String(
              o.provider === "PAYSTACK"
                ? p.id
                : p.payment_reference || p.reference,
            ),
          })
          .eq("order_id", o.id)
          .eq("status", "SUCCESS");
      } catch {
        counts.blocked++;
      }
    }),
  );
  return { ...counts, configured: true };
}

edge.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST")
    return Response.json({ error: "POST required" }, { status: 405 });
  const url = edge.env.get("SUPABASE_URL");
  const serviceKey = edge.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey)
    return Response.json({ error: "Worker not configured" }, { status: 503 });
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!bearer) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = JSON.parse(
      atob(bearer.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.role !== "service_role")
      return Response.json({ error: "Service role required" }, { status: 401 });
  } catch {
    return Response.json({ error: "Invalid bearer" }, { status: 401 });
  }
  // The Edge gateway verifies JWT signatures. Independently, PostgREST validates this
  // exact caller bearer and platform_jobs asserts auth.role()=service_role before any
  // work. Decoding above is only an early filter, never the authorization decision.
  // Valid legacy keys may differ from the Edge environment's built-in credential.
  const db = createClient(url, serviceKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("platform_jobs");
  if (error || !data?.run_id || !Array.isArray(data.review_video_cleanup)) {
    console.error("platform_jobs rejected", { code: error?.code });
    return Response.json(
      { error: "Job batch rejected" },
      { status: error?.code === "42501" ? 401 : 502 },
    );
  }
  const deleted: string[] = [],
    failed: string[] = [];
  for (const candidate of data.review_video_cleanup as Candidate[]) {
    if (
      !UUID.test(candidate.submission_id) ||
      !VIDEO_PATH.test(candidate.video_path)
    ) {
      failed.push(candidate.submission_id);
      continue;
    }
    const result = await db.storage
      .from("review-videos")
      .remove([candidate.video_path]);
    if (result.error) {
      console.error("review cleanup failed", {
        submission_id: candidate.submission_id,
        code: result.error.name,
      });
      failed.push(candidate.submission_id);
    } else deleted.push(candidate.submission_id);
  }
  const completion = await db.rpc("complete_review_video_cleanup", {
    p_run_id: data.run_id,
    p_deleted_submission_ids: deleted,
    p_failed_submission_ids: failed,
  });
  if (completion.error) {
    console.error("cleanup completion failed", {
      run_id: data.run_id,
      code: completion.error.code,
    });
    return Response.json(
      { error: "Metadata completion failed", run_id: data.run_id },
      { status: 502 },
    );
  }
  const payment_reconciliation = await reconcilePayments(db);
  return Response.json(
    {
      run_id: data.run_id,
      counts: data.counts,
      review_video_cleanup: completion.data,
      payment_reconciliation,
    },
    { status: failed.length ? 207 : 200 },
  );
});
