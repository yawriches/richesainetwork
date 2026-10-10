"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, ChevronDown, Send, Sparkles, X } from "lucide-react";
import { getData } from "@/lib/ui";

type Message = {
  role: "USER" | "ASSISTANT";
  content: string;
  sources?: { number: number; id: string; title: string }[];
};

function visitorId() {
  if (typeof window === "undefined") return null;
  const key = "riches-ai-support-visitor";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() || null;
  if (next) window.sessionStorage.setItem(key, next);
  return next;
}

export function AiSupportAssistant({ mode }: { mode: "public" | "learner" }) {
  const [status, setStatus] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getData("ai_support_status")
      .then((result) => setStatus(result.data?.[0] || null))
      .catch(() => setStatus(null));
  }, []);

  const available = Boolean(
    status?.enabled && (mode === "learner" ? status?.learner_enabled : status?.public_enabled),
  );
  const intro = useMemo(
    () =>
      status?.welcome_message ||
      "Ask about courses, learning, membership, or how to use Riches AI Network.",
    [status],
  );

  async function ask(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value || busy) return;
    setQuestion("");
    setError("");
    setMessages((current) => [...current, { role: "USER", content: value }]);
    setBusy(true);
    try {
      const response = await fetch("/api/ai-support", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: value,
          visitor_id: visitorId(),
          conversation_id: conversationId,
        }),
      });
      const result = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !result.ok)
        throw new Error(result.error || status?.fallback_message || "AI support is unavailable right now.");
      setMessages((current) => [
        ...current,
        {
          role: "ASSISTANT",
          content: result.data?.answer || status?.fallback_message,
          sources: Array.isArray(result.data?.sources) ? result.data.sources : [],
        },
      ]);
      if (result.data?.conversation_id) setConversationId(result.data.conversation_id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI support is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  if (!available) return null;
  const humanSupport = mode === "learner" ? "/support" : "/contact";
  return (
    <aside className={`ai-support-widget ai-support-widget-${mode}`} aria-label="AI support assistant">
      {open ? (
        <section className="ai-support-panel">
          <header className="ai-support-panel-head">
            <div className="ai-support-orb" aria-hidden="true"><Sparkles size={16} /></div>
            <div>
              <strong>Riches AI support</strong>
              <span>{mode === "learner" ? "Learning-aware guidance" : "Platform and course guidance"}</span>
            </div>
            <button type="button" className="icon-button icon-button-small" onClick={() => setOpen(false)} aria-label="Close AI support"><X size={16} /></button>
          </header>
          <div className="ai-support-thread" aria-live="polite">
            {!messages.length && (
              <div className="ai-support-message ai-support-message-assistant">
                <Bot size={15} />
                <p>{intro}</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`ai-support-message ai-support-message-${message.role.toLowerCase()}`}>
                {message.role === "ASSISTANT" && <Bot size={15} />}
                <div>
                  <p>{message.content}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="ai-support-sources">
                      {message.sources.map((source) => <span key={source.id}>[{source.number}] {source.title}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="ai-support-message ai-support-message-assistant"><Bot size={15} /><p>Checking approved guidance…</p></div>}
          </div>
          {error && <p className="form-alert ai-support-error" role="alert">{error}</p>}
          <form className="ai-support-form" onSubmit={ask}>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={3} placeholder="Ask a question about learning or the platform…" aria-label="Ask AI support" />
            <div>
              <small>Private course answers require confirmed access.</small>
              <button className="btn btn-small" disabled={busy || !question.trim()}><Send size={14} /> Ask</button>
            </div>
          </form>
          <footer className="ai-support-footer">Need a person? <Link href={humanSupport}>Open human support</Link></footer>
        </section>
      ) : (
        <button type="button" className="ai-support-launcher" onClick={() => setOpen(true)} aria-label="Open AI support">
          <span className="ai-support-orb" aria-hidden="true"><Sparkles size={17} /></span>
          <span>Ask AI support</span>
          <ChevronDown size={15} />
        </button>
      )}
    </aside>
  );
}
