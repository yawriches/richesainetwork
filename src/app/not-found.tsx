import Link from "next/link";
import { ArrowLeft, ArrowRight, Compass } from "lucide-react";
import { Wordmark } from "@/components/site";
export default function NotFound() {
  return (
    <main className="auth-wrap">
      <section className="card auth-card" style={{ textAlign: "left" }}>
        <Wordmark />
        <div style={{ marginTop: 44 }}>
          <span className="eyebrow">A wrong turn happens</span>
          <div
            className="display"
            style={{ fontSize: 84, color: "#80945b", marginTop: 8 }}
          >
            404
          </div>
          <h1 className="display" style={{ fontSize: 34, margin: "0 0 10px" }}>
            We can’t find that page.
          </h1>
          <p className="muted">
            The link may have moved, or this content may not be published. Let’s
            get you back to a useful next step.
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 22,
            }}
          >
            <Link className="btn" href="/">
              <ArrowLeft size={15} /> Home
            </Link>
            <Link className="btn btn-outline" href="/courses">
              <Compass size={15} /> Explore courses <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
