"use client";
import { useState, type FormEvent } from "react";
import { postAction } from "@/lib/ui";
export function ContactForm() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const fields = new FormData(form);
      const result = await postAction("contact", Object.fromEntries(fields));
      if (!result.ok) {
        setError(result.error || "Your message could not be sent.");
        return;
      }
      setSuccess(
        result.message || "Your message has been received by the team.",
      );
      form.reset();
    } catch {
      setError("We could not reach the network. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      action="/api/auth/form"
      method="post"
      onSubmit={submit}
      className="form-stack"
      style={{ marginTop: 28 }}
    >
      <input type="hidden" name="kind" value="contact" />
      <h2 className="font-display" style={{ fontSize: 27 }}>
        Send the team a message
      </h2>
      <div className="field">
        <label htmlFor="contact-name">Your name</label>
        <input
          className="input"
          id="contact-name"
          name="name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
        />
      </div>
      <div className="field">
        <label htmlFor="contact-email">Email address</label>
        <input
          className="input"
          id="contact-email"
          name="email"
          required
          type="email"
          autoComplete="email"
        />
      </div>
      <div className="field">
        <label htmlFor="contact-message">How can we help?</label>
        <textarea
          className="textarea"
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
        />
      </div>
      <input
        name="website"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        style={{ display: "none" }}
      />
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="form-alert form-alert-success" role="status">
          {success}
        </p>
      )}
      <button className="btn" disabled={busy}>
        {busy ? "Sending…" : "Send message"}
      </button>
      <p className="field-hint">
        Please do not include passwords, payment details, or secret keys.
      </p>
    </form>
  );
}
