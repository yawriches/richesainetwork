import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
export const metadata: Metadata = {
  title: "Contact",
  description: "Get help finding your way around Riches AI Network.",
};
export default function Contact() {
  return (
    <>
      <section className="section-sm">
        <div className="wrap" style={{ maxWidth: 850 }}>
          <span className="eyebrow">We’re here to help you find your way</span>
          <h1
            className="display"
            style={{ fontSize: "clamp(48px,8vw,82px)", margin: "16px 0 21px" }}
          >
            Let’s make your next step clearer.
          </h1>
          <p className="muted" style={{ maxWidth: 610, fontSize: 17 }}>
            For help with your learning or account, sign in to reach the support
            options available to you. You can also explore the most common
            starting points below.
          </p>
        </div>
      </section>
      <section style={{ padding: "8px 0 82px" }}>
        <div className="wrap" style={{ maxWidth: 850 }}>
          <div className="grid-2">
            <article className="card" style={{ padding: 27 }}>
              <Mail size={22} color="#6657e8" />
              <h2
                className="font-display"
                style={{ fontSize: 22, margin: "18px 0 6px" }}
              >
                Account and learning
              </h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Sign in to view your enrolled courses, progress, and account
                options.
              </p>
              <Link
                href="/login"
                className="link-under"
                style={{ fontWeight: 700, fontSize: 13 }}
              >
                Sign in <ArrowRight size={15} />
              </Link>
            </article>
            <article className="card" style={{ padding: 27 }}>
              <LifeBuoy size={22} color="#6657e8" />
              <h2
                className="font-display"
                style={{ fontSize: 22, margin: "18px 0 6px" }}
              >
                Expert support
              </h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Signed-in learners can check available support packages and
                appointment options.
              </p>
              <Link
                href="/support"
                className="link-under"
                style={{ fontWeight: 700, fontSize: 13 }}
              >
                View support options <ArrowRight size={15} />
              </Link>
            </article>
          </div>
          <ContactForm />
          <div
            className="soft-panel"
            style={{ marginTop: 22, display: "flex", gap: 14 }}
          >
            <MessageCircle size={18} />
            <p style={{ fontSize: 12, margin: 0, color: "#777a87" }}>
              Support availability, contact channels, and response times will be
              shown here only when the network has configured them.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
