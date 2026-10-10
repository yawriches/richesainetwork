"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { postAction } from "@/lib/ui";

const initial = {
  name: "",
  email: "",
  phone: "",
  country_code: "",
  current_situation: "",
  ai_experience: "BEGINNER",
  primary_goal: "",
  project_idea: "",
  weekly_hours: "FIVE_TO_TEN",
  motivation: "",
  support_needs: "",
  consent: false,
  website: "",
};

export function MentorshipApplication({
  countries,
}: {
  countries: Array<{ code: string; name: string }>;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await postAction("mentorship_application_submit", form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    setForm(initial);
  }

  if (submitted)
    return (
      <section className="mentorship-confirmation" aria-live="polite">
        <CheckCircle2 size={28} aria-hidden="true" />
        <div>
          <span className="eyebrow">Application received</span>
          <h2 className="font-display">Thank you for applying.</h2>
          <p>
            The team will review your application and contact you using the
            details you provided. A submitted application is not an acceptance,
            place reservation, or payment request.
          </p>
          <button className="btn btn-outline" type="button" onClick={() => setSubmitted(false)}>
            Submit another application <ArrowRight size={15} />
          </button>
        </div>
      </section>
    );

  return (
    <form className="mentorship-form" onSubmit={submit}>
      <div className="mentorship-form-heading">
        <div>
          <span className="eyebrow">Private application</span>
          <h2 className="font-display">Tell us where you are starting from.</h2>
          <p className="muted">
            Thoughtful answers help us understand whether this six-week working
            partnership is the right fit. Fields marked with an asterisk are required.
          </p>
        </div>
        <span className="mentorship-form-count">6 weeks · 1:1</span>
      </div>

      <div className="mentorship-form-grid">
        <label className="field">
          <span>Full name *</span>
          <input className="input" value={form.name} maxLength={120} required onChange={(event) => set("name", event.target.value)} />
        </label>
        <label className="field">
          <span>Email address *</span>
          <input className="input" type="email" value={form.email} maxLength={320} required onChange={(event) => set("email", event.target.value)} />
        </label>
        <label className="field">
          <span>Phone or WhatsApp number *</span>
          <input className="input" type="tel" value={form.phone} maxLength={40} required onChange={(event) => set("phone", event.target.value)} />
        </label>
        <label className="field">
          <span>Country *</span>
          <select className="select" value={form.country_code} required onChange={(event) => set("country_code", event.target.value)}>
            <option value="">Choose your country…</option>
            {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </label>
        <label className="field mentorship-form-span">
          <span>Where are you right now? *</span>
          <textarea className="textarea" rows={4} value={form.current_situation} minLength={30} maxLength={2400} required placeholder="Share your current work, business, skill, or income situation and what has brought you here." onChange={(event) => set("current_situation", event.target.value)} />
        </label>
        <label className="field">
          <span>Current AI experience *</span>
          <select className="select" value={form.ai_experience} onChange={(event) => set("ai_experience", event.target.value)}>
            <option value="BEGINNER">I am just getting started</option>
            <option value="FOUNDATIONAL">I understand the foundations</option>
            <option value="PRACTICAL">I already build with AI</option>
            <option value="ADVANCED">I have advanced practical experience</option>
          </select>
        </label>
        <label className="field">
          <span>Weekly time available *</span>
          <select className="select" value={form.weekly_hours} onChange={(event) => set("weekly_hours", event.target.value)}>
            <option value="UNDER_5">Under 5 hours</option>
            <option value="FIVE_TO_TEN">5–10 hours</option>
            <option value="TEN_TO_FIFTEEN">10–15 hours</option>
            <option value="FIFTEEN_PLUS">15+ hours</option>
          </select>
        </label>
        <label className="field mentorship-form-span">
          <span>What would you like to achieve in six weeks? *</span>
          <textarea className="textarea" rows={4} value={form.primary_goal} minLength={10} maxLength={2000} required placeholder="Describe the specific capability, offer, workflow, or direction you want to work toward." onChange={(event) => set("primary_goal", event.target.value)} />
        </label>
        <label className="field mentorship-form-span">
          <span>What project, offer, or idea would you work on? *</span>
          <textarea className="textarea" rows={4} value={form.project_idea} minLength={10} maxLength={2400} required placeholder="It can be an early idea. Share enough context for a practical conversation." onChange={(event) => set("project_idea", event.target.value)} />
        </label>
        <label className="field mentorship-form-span">
          <span>Why is this the right time for you? *</span>
          <textarea className="textarea" rows={4} value={form.motivation} minLength={30} maxLength={2400} required onChange={(event) => set("motivation", event.target.value)} />
        </label>
        <label className="field mentorship-form-span">
          <span>What kind of support would help most? *</span>
          <textarea className="textarea" rows={3} value={form.support_needs} minLength={2} maxLength={1200} required placeholder="For example: positioning, building a repeatable workflow, accountability, or feedback." onChange={(event) => set("support_needs", event.target.value)} />
        </label>
      </div>

      <div className="mentorship-honeypot" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => set("website", event.target.value)} />
        </label>
      </div>
      <label className="mentorship-consent">
        <input type="checkbox" checked={form.consent} required onChange={(event) => set("consent", event.target.checked)} />
        <span>I understand this is an application for consideration, not a promise of acceptance, income, or an automatic payment request. *</span>
      </label>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <button className="btn" disabled={busy}>
        {busy ? <><LoaderCircle className="spin" size={16} /> Sending application…</> : <>Submit application <ArrowRight size={16} /></>}
      </button>
    </form>
  );
}
