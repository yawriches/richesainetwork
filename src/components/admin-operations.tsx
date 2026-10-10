"use client";
import { useEffect, useState, type FormEvent } from "react";
import { asArray, getData, postAction, money } from "@/lib/ui";
export function ManualCourseGrant({ userId }: { userId: string }) {
  const [courses, setCourses] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    getData("admin", { table: "courses" }).then((r) =>
      setCourses(
        asArray(r.data).filter(
          (c) =>
            c.status === "PUBLISHED" &&
            c.access_type === "PURCHASE" &&
            c.product_id,
        ),
      ),
    );
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const r = await postAction("admin_grant_course", {
      user_id: userId,
      course_id: f.get("course_id"),
      reason: f.get("reason"),
    });
    setMessage(
      r.ok
        ? "Access granted and audited. No payment was recorded."
        : r.error || "Grant failed.",
    );
    setBusy(false);
  }
  return (
    <details className="soft-panel" style={{ margin: "14px 0" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Grant course access without a purchase
      </summary>
      <form
        onSubmit={submit}
        style={{ display: "grid", gap: 10, marginTop: 12 }}
      >
        <p className="field-hint">
          A deliberate admin grant. It does not create or mark a payment
          successful.
        </p>
        <select name="course_id" className="select" required>
          <option value="">Choose a published purchase course</option>
          {courses.map((c) => (
            <option value={c.id} key={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <input
          name="reason"
          className="input"
          placeholder="Reason (required for the audit trail)"
          required
          minLength={5}
          maxLength={500}
        />
        <button className="btn btn-small" disabled={busy || !courses.length}>
          {busy ? "Granting…" : "Grant and audit access"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
export function ExistingRefundImport() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const r = await postAction("record_existing_refund", {
      provider: f.get("provider"),
      refund_id: f.get("refund_id"),
      order_reference: f.get("order_reference"),
    });
    setMessage(
      r.ok
        ? `Provider verified: ${r.data?.status || "PENDING"}. No refund was initiated.`
        : r.error || "The provider could not verify that refund.",
    );
    setBusy(false);
  }
  return (
    <details className="soft-panel" style={{ marginBottom: 20 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Verify an already-processed test refund
      </summary>
      <form
        onSubmit={submit}
        style={{ display: "grid", gap: 10, marginTop: 12 }}
      >
        <p className="field-hint">
          Read-only provider lookup. This never initiates a refund. Completed
          refunds update the ledger and the configured full-refund access
          policy.
        </p>
        <select name="provider" className="select" required>
          <option value="PAYSTACK">Paystack (test)</option>
          <option value="KORA">Kora (test)</option>
        </select>
        <input
          className="input"
          name="order_reference"
          placeholder="Original arn-… order reference"
          required
        />
        <input
          className="input"
          name="refund_id"
          placeholder="Existing provider refund ID/reference"
          required
        />
        <button className="btn btn-small" disabled={busy}>
          {busy ? "Verifying…" : "Verify and record existing refund"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
