"use client";
import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { postAction, getData, asArray, text } from "@/lib/ui";

type Kind =
  "login" | "register" | "forgot_password" | "reset_password" | "onboarding";
const copy: Record<Kind, { title: string; intro: string; submit: string }> = {
  login: {
    title: "Welcome back.",
    intro: "Pick up where you left off in your learning journey.",
    submit: "Log in",
  },
  register: {
    title: "Make room for your next chapter.",
    intro: "Create a free account to keep track of your learning.",
    submit: "Create account",
  },
  forgot_password: {
    title: "A fresh start is close.",
    intro: "Enter the email address associated with your account.",
    submit: "Send reset instructions",
  },
  reset_password: {
    title: "Choose a new password.",
    intro: "Use a strong password you don’t use elsewhere.",
    submit: "Update password",
  },
  onboarding: {
    title: "Make your learning yours.",
    intro: "A few details help shape your starting point.",
    submit: "Save my profile",
  },
};
export function AuthForm({ kind }: { kind: Kind }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [countries, setCountries] = useState<any[]>([]);
  const [countryReady, setCountryReady] = useState(false);
  useEffect(() => {
    if (kind === "onboarding") {
      getData("countries")
        .then((r) => {
          setCountries(asArray(r.data));
          setCountryReady(r.configured !== false);
        })
        .catch(() => setCountryReady(false));
    }
  }, [kind]);
  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("error") ===
      "verification"
    )
      setError(
        "That verification or recovery link is missing, expired, or already used. Request a fresh email and open its complete link.",
      );
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    let action = kind;
    let payload: any = {};
    if (kind === "login")
      payload = { email: f.get("email"), password: f.get("password") };
    if (kind === "register") {
      const password = String(f.get("password") || "");
      if (password !== f.get("confirm_password")) {
        setError("Those passwords don’t match. Please check and try again.");
        setBusy(false);
        return;
      }
      payload = { name: f.get("name"), email: f.get("email"), password };
    }
    if (kind === "forgot_password") payload = { email: f.get("email") };
    if (kind === "reset_password") payload = { password: f.get("password") };
    if (kind === "onboarding") {
      action = "onboarding";
      payload = {
        name: f.get("name"),
        country_code: f.get("country_code"),
        interests: f.getAll("interests"),
        experience_level: f.get("experience_level"),
      };
    }
    const result = await postAction(action, payload);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.error || "We couldn’t complete that request. Please try again.",
      );
      return;
    }
    if (kind === "login") {
      window.location.assign(result.data?.redirect || "/dashboard");
      return;
    }
    if (kind === "register") {
      setSuccess(
        result.message ||
          "Registration received. Follow the verification instructions shown by the service before signing in.",
      );
      return;
    }
    if (kind === "forgot_password") {
      setSuccess(
        result.message ||
          "If an account matches that email, the service will provide the next reset step.",
      );
      return;
    }
    if (kind === "reset_password") {
      setSuccess(
        result.message ||
          "Password update complete. You can now sign in if the service confirms the change.",
      );
      return;
    }
    setSuccess(result.message || "Your learning profile has been saved.");
    router.push("/dashboard");
    router.refresh();
  }
  const meta = copy[kind];
  const passwordField = (name: string, label: string, autoComplete: string) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          className="input"
          id={name}
          name={name}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={8}
          required
          style={{ paddingRight: 48 }}
        />
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword(!showPassword)}
          style={{
            position: "absolute",
            right: 12,
            top: 10,
            border: 0,
            background: "transparent",
            color: "#747784",
            padding: 5,
          }}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
  return (
    <div className="auth-wrap">
      <section className="card auth-card">
        <Link
          href="/"
          className="eyebrow"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} /> Riches AI Network
        </Link>
        <div style={{ marginTop: 30 }}>
          <span className="badge badge-yellow">
            <ShieldCheck size={14} /> Your learning space
          </span>
          <h1
            className="display"
            style={{ fontSize: 38, margin: "17px 0 8px" }}
          >
            {meta.title}
          </h1>
          <p className="muted" style={{ fontSize: 14, margin: "0 0 26px" }}>
            {meta.intro}
          </p>
        </div>
        <form
          method="post"
          action="/api/auth/form"
          onSubmit={submit}
          style={{ display: "grid", gap: 16 }}
        >
          <input type="hidden" name="kind" value={kind} />
          {kind === "register" && (
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input
                className="input"
                id="name"
                name="name"
                autoComplete="name"
                minLength={2}
                required
                placeholder="How should we address you?"
              />
            </div>
          )}
          {(kind === "login" ||
            kind === "register" ||
            kind === "forgot_password") && (
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
          )}
          {(kind === "login" || kind === "register") &&
            passwordField(
              "password",
              "Password",
              kind === "login" ? "current-password" : "new-password",
            )}
          {kind === "register" && (
            <div className="field">
              <label htmlFor="confirm_password">Confirm password</label>
              <input
                className="input"
                id="confirm_password"
                name="confirm_password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          )}
          {kind === "reset_password" &&
            passwordField("password", "New password", "new-password")}
          {kind === "onboarding" && (
            <>
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  className="input"
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  placeholder="Your name"
                />
              </div>
              <div className="field">
                <label htmlFor="country_code">Country</label>
                <select
                  className="select"
                  id="country_code"
                  name="country_code"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    {countryReady
                      ? "Choose your country"
                      : "Country options are being connected"}
                  </option>
                  {countries.map((c: any) => (
                    <option key={c.code || c.id} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  Country options come from the network settings.
                </span>
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label" style={{ marginBottom: 9 }}>
                  What would you like to explore? Choose at least one.
                </legend>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {[
                    { code: "AI_VIDEO", label: "AI Video" },
                    { code: "AI_GRAPHICS", label: "Graphics" },
                    { code: "PHOTOGRAPHY", label: "Photography" },
                    { code: "AUTOMATION", label: "Automation" },
                    { code: "MAKING_MONEY", label: "Making Money With AI" },
                    { code: "CONTENT_CREATION", label: "Content Creation" },
                    { code: "EXPLORING", label: "Just Exploring" },
                  ].map((v) => (
                    <label
                      key={v.code}
                      className="pill"
                      style={{
                        cursor: "pointer",
                        justifyContent: "flex-start",
                      }}
                    >
                      <input name="interests" type="checkbox" value={v.code} />
                      {v.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor="experience_level">
                  How familiar are you with AI tools?
                </label>
                <select
                  id="experience_level"
                  name="experience_level"
                  className="select"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  <option value="BEGINNER">I’m just getting started</option>
                  <option value="INTERMEDIATE">I’ve tried a few tools</option>
                  <option value="ADVANCED">I use AI tools regularly</option>
                </select>
              </div>
            </>
          )}
          {error && (
            <div className="form-alert" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="form-alert form-success" role="status">
              {success}
              {kind === "register" && (
                <div style={{ marginTop: 12 }}>
                  <Link
                    href="/login"
                    className="link-under"
                    style={{ fontWeight: 700 }}
                  >
                    Continue to log in <ArrowRight size={15} />
                  </Link>
                </div>
              )}
            </div>
          )}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Working…" : meta.submit}{" "}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>
        {kind === "login" && (
          <p style={{ fontSize: 12, textAlign: "center", margin: "16px 0 0" }}>
            <Link href="/forgot-password" className="link-under">
              Forgot your password?
            </Link>
          </p>
        )}
        {kind === "login" && (
          <p
            style={{
              fontSize: 13,
              textAlign: "center",
              margin: "20px 0 0",
              color: "#777a87",
            }}
          >
            New to the network?{" "}
            <Link
              href="/register"
              className="link-under"
              style={{ color: "#5748d1", fontWeight: 700 }}
            >
              Create an account
            </Link>
          </p>
        )}
        {kind === "register" && (
          <p
            style={{
              fontSize: 12,
              color: "#777a87",
              margin: "16px 0 0",
              textAlign: "center",
            }}
          >
            We’ll show you whether any email verification step is required.
            Registration does not confirm course purchases.
          </p>
        )}
        {kind === "forgot_password" && (
          <p style={{ fontSize: 13, textAlign: "center", margin: "18px 0 0" }}>
            <Link href="/login" className="link-under">
              Back to log in
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
