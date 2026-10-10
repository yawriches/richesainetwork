"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { postAction } from "@/lib/ui";

type Result = {
  loading: boolean;
  error?: string;
  status?: string;
  course?: { id: string; title: string; slug: string } | null;
  productType?: string | null;
};

function PaymentResult() {
  const params = useSearchParams();
  const [state, setState] = useState<Result>({ loading: true });
  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref") || "";
    if (!reference) {
      setState({
        loading: false,
        error:
          "No payment reference was provided. Your purchase has not been confirmed.",
      });
      return;
    }
    postAction("verify_payment", { reference })
      .then((r) => {
        if (!r.ok) setState({ loading: false, error: r.error });
        else
          setState({
            loading: false,
            status: String(r.data?.status || "PENDING").toUpperCase(),
            course: r.data?.course || null,
            productType: r.data?.product_type || null,
          });
      })
      .catch(() =>
        setState({
          loading: false,
          error:
            "We could not confirm the payment with the provider. Check your purchase history before trying again.",
        }),
      );
  }, [params]);

  if (state.loading)
    return (
      <>
        <Clock3 size={28} color="#6657e8" />
        <h1 className="display" style={{ fontSize: 32 }}>
          Checking your payment.
        </h1>
        <p className="muted">
          We’re asking the payment service to confirm the result. Please keep
          this page open.
        </p>
      </>
    );

  if (state.error)
    return (
      <>
        <ShieldAlert size={28} color="#d15c73" />
        <h1 className="display" style={{ fontSize: 32 }}>
          Payment not confirmed yet.
        </h1>
        <p className="muted">{state.error}</p>
        <Actions secondary />
      </>
    );

  const { status, course, productType } = state;
  if (status === "SUCCESS")
    return (
      <>
        <CheckCircle2 size={28} color="#6657e8" />
        <h1 className="display" style={{ fontSize: 32 }}>
          Payment confirmed.
        </h1>
        <p className="muted">
          {course
            ? `You now have access to “${course.title}”.`
            : productType === "MEMBERSHIP"
              ? "Your membership is now active."
              : productType === "REVIEW"
                ? "Your review credits have been added."
                : "Your purchase has been added to your account."}
        </p>
        {course ? (
          <Link className="btn" href={`/learn/${course.id}`} style={{ marginTop: 10 }}>
            Start learning <ArrowRight size={15} />
          </Link>
        ) : (
          <Link
            className="btn"
            href={productType === "REVIEW" ? "/reviews/new" : productType === "MEMBERSHIP" ? "/community" : "/dashboard"}
            style={{ marginTop: 10 }}
          >
            Continue <ArrowRight size={15} />
          </Link>
        )}
        <Actions />
      </>
    );

  if (status === "REQUIRES_ACTION")
    return (
      <>
        <Clock3 size={28} color="#6657e8" />
        <h1 className="display" style={{ fontSize: 32 }}>
          Payment received.
        </h1>
        <p className="muted">
          Your payment was confirmed, and our team is finishing your access.
          You don’t need to pay again.
        </p>
        <Actions secondary />
      </>
    );

  if (status === "FAILED" || status === "CANCELLED")
    return (
      <>
        <ShieldAlert size={28} color="#d15c73" />
        <h1 className="display" style={{ fontSize: 32 }}>
          {status === "CANCELLED" ? "Payment cancelled." : "Payment failed."}
        </h1>
        <p className="muted">
          No money was taken for this order. You can try again whenever you’re
          ready.
        </p>
        {course ? (
          <Link className="btn" href={`/marketplace/${course.slug}`} style={{ marginTop: 10 }}>
            Back to course <ArrowRight size={15} />
          </Link>
        ) : (
          <Link className="btn" href="/marketplace" style={{ marginTop: 10 }}>
            Back to marketplace <ArrowRight size={15} />
          </Link>
        )}
      </>
    );

  return (
    <>
      <Clock3 size={28} color="#6657e8" />
      <h1 className="display" style={{ fontSize: 32 }}>
        Payment still processing.
      </h1>
      <p className="muted">
        The payment service hasn’t confirmed this payment yet. If you completed
        it, your access will appear automatically within a few minutes — you
        don’t need to pay again.
      </p>
      <Actions secondary />
    </>
  );
}

function Actions({ secondary = false }: { secondary?: boolean }) {
  return (
    <Link
      className={secondary ? "btn" : "link-under"}
      href="/account/purchases"
      style={{ marginTop: 10, display: "inline-flex", gap: 6 }}
    >
      View purchase history <ArrowRight size={15} />
    </Link>
  );
}

export default function PaymentReturn() {
  return (
    <main className="auth-wrap">
      <section
        className="card auth-card"
        style={{ textAlign: "center", display: "grid", justifyItems: "center", gap: 6 }}
      >
        <Suspense fallback={<p className="muted">Checking your payment…</p>}>
          <PaymentResult />
        </Suspense>
      </section>
    </main>
  );
}
