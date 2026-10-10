"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { asArray, getData, money, postAction } from "@/lib/ui";
export function PurchasePanel({
  productId,
  priceId,
  plan,
  label = "Continue to checkout",
}: {
  productId: string;
  priceId?: string;
  plan?: any;
  label?: string;
}) {
  const [state, setState] = useState<any>({ loading: true }),
    [chosen, setChosen] = useState(""),
    [provider, setProvider] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      getData("me").catch(() => null),
      getData("product_prices", { product_id: productId }),
      getData("currencies"),
      getData("payment_readiness"),
    ])
      .then(([me, prices, currencies, readiness]) => {
        if (active)
          setState({
            loading: false,
            profile: me?.data?.profile,
            user: me?.data?.user,
            prices: asArray(prices.data),
            currencies: asArray(currencies.data),
            providers: asArray(readiness.data?.providers),
          });
      })
      .catch(
        () =>
          active &&
          setState({
            loading: false,
            error: "Checkout options could not be loaded.",
          }),
      );
    return () => {
      active = false;
    };
  }, [productId]);
  if (state.loading)
    return <p className="field-hint">Checking purchase options…</p>;
  if (state.error)
    return (
      <div className="form-alert" role="alert">
        {state.error}
      </div>
    );
  if (!state.user)
    return (
      <Link className="btn" href="/login">
        Sign in to continue <ArrowRight size={15} />
      </Link>
    );
  const country = state.profile?.country_code;
  if (!country)
    return (
      <div className="soft-panel">
        <p className="field-hint">Choose your country before checkout.</p>
        <Link href="/onboarding" className="link-under">
          Complete your learning profile
        </Link>
      </div>
    );
  const now = Date.now();
  const prices = state.prices.filter(
    (p: any) =>
      (!priceId || p.id === priceId) &&
      (!p.country_code || p.country_code === country) &&
      (!p.starts_at || new Date(p.starts_at).getTime() <= now) &&
      (!p.ends_at || new Date(p.ends_at).getTime() > now),
  );
  const price = prices.find((p: any) => p.id === chosen) || prices[0];
  const providers = state.providers.filter(
    (p: any) =>
      p.ready &&
      p.countries?.includes(country) &&
      p.currencies?.includes(price?.currency) &&
      (!plan || plan.providers?.includes(p.code)),
  );
  async function purchase() {
    setBusy(true);
    setError("");
    const result = await postAction("checkout", {
      price_id: price.id,
      provider,
      country_code: country,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data?.url) window.location.assign(result.data.url);
    else
      setError(
        "The provider did not return a checkout page. No purchase has been confirmed.",
      );
  }
  if (!price || (plan && !plan.countries?.includes(country)))
    return (
      <p className="field-hint">
        This product has no eligible price for your country yet. Your account
        and free learning remain available.
      </p>
    );
  const precision = state.currencies.find(
    (c: any) => c.code === price.currency,
  )?.minor_units;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {prices.length > 1 && (
        <div className="field">
          <label>
            Price option
            <select
              className="select"
              value={price.id}
              onChange={(e) => {
                setChosen(e.target.value);
                setProvider("");
              }}
            >
              {prices.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {money(
                    p.amount,
                    p.currency,
                    state.currencies.find((c: any) => c.code === p.currency)
                      ?.minor_units,
                  )}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <strong>{money(price.amount, price.currency, precision)}</strong>
      {plan && (
        <p className="field-hint" style={{ margin: 0 }}>
          Manual renewal. Each purchase adds a paid period; this is not
          automatic billing.
        </p>
      )}
      {providers.length ? (
        <>
          <div className="field">
            <label>
              Payment provider
              <select
                className="select"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="">Choose a ready provider</option>
                {providers.map((p: any) => (
                  <option value={p.code} key={p.code}>
                    {p.name} · {p.mode}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field-hint" style={{ margin: 0 }}>
            <ShieldCheck size={13} /> Test checkout is enabled only after
            merchant configuration. Do not enter real payment details in test
            mode.
          </p>
          <button
            className="btn"
            onClick={purchase}
            disabled={busy || !provider}
          >
            {busy ? "Opening secure checkout…" : label}
            <ArrowRight size={15} />
          </button>
        </>
      ) : (
        <p className="field-hint">
          Checkout is not available yet: the team must configure a provider for
          this price, country, and plan. No payment will be taken here.
        </p>
      )}
      {error && (
        <div className="form-alert" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
export function ReviewCreditPurchase() {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    getData("products", { type: "REVIEW" })
      .then((r) => setProducts(asArray(r.data)))
      .catch(() => {});
  }, []);
  if (!products.length) return null;
  return (
    <section className="card" style={{ padding: 22, marginBottom: 22 }}>
      <h2 className="font-display" style={{ fontSize: 21, margin: "0 0 8px" }}>
        Need another review?
      </h2>
      <p className="field-hint">
        Purchased credits are separate from your included monthly allowance.
      </p>
      {products.map((p) => (
        <div key={p.id}>
          <strong>{p.name}</strong>
          <PurchasePanel productId={p.id} label="Buy review credits" />
        </div>
      ))}
    </section>
  );
}
