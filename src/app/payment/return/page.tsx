"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { postAction } from "@/lib/ui";
export default function PaymentReturn() {
  const params = useSearchParams();
  const [state, setState] = useState<any>({ loading: true });
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
        else setState({ loading: false, data: r.data, message: r.message });
      })
      .catch(() =>
        setState({
          loading: false,
          error:
            "We could not confirm the payment with the provider. Check your purchase history before trying again.",
        }),
      );
  }, [params]);
  return (
    <main className="auth-wrap">
      <section className="card auth-card" style={{ textAlign: "center" }}>
        {state.loading ? (
          <>
            <Clock3 size={28} color="#6657e8" />
            <h1 className="display" style={{ fontSize: 32 }}>
              Checking your payment.
            </h1>
            <p className="muted">
              We’re asking the payment service to verify the result. Please keep
              this page open.
            </p>
          </>
        ) : state.error ? (
          <>
            <ShieldAlert size={28} color="#d15c73" />
            <h1 className="display" style={{ fontSize: 32 }}>
              Payment not confirmed yet.
            </h1>
            <p className="muted">{state.error}</p>
          </>
        ) : (
          <>
            <CheckCircle2 size={28} color="#6657e8" />
            <h1 className="display" style={{ fontSize: 32 }}>
              Provider check complete.
            </h1>
            <p className="muted">
              {state.message ||
                "The provider returned a result. Check your account for the verified order status."}
            </p>
          </>
        )}
        <Link
          className="btn"
          href="/account/purchases"
          style={{ marginTop: 10 }}
        >
          View purchase history <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
