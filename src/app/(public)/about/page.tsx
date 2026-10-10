import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, MessageCircle, Waypoints } from "lucide-react";
export const metadata: Metadata = {
  title: "Our approach",
  description:
    "How Riches AI Network makes practical AI learning approachable.",
};
export default function About() {
  return (
    <>
      <section className="section-sm">
        <div className="wrap" style={{ maxWidth: 900 }}>
          <span className="eyebrow">About Riches AI Network</span>
          <h1
            className="display"
            style={{ fontSize: "clamp(48px,8vw,88px)", margin: "16px 0 22px" }}
          >
            Skills first. Possibilities follow.
          </h1>
          <p
            className="muted"
            style={{ maxWidth: 660, fontSize: 18, lineHeight: 1.7 }}
          >
            AI tools change quickly. Confidence grows by learning the
            fundamentals, testing ideas, and building things that matter to you.
          </p>
        </div>
      </section>
      <section style={{ padding: "20px 0 85px" }}>
        <div className="wrap">
          <div className="grid-3">
            {[
              [
                BookOpen,
                "Make learning approachable",
                "Clear lessons help you begin without needing a technical background.",
              ],
              [
                Waypoints,
                "Practice as you learn",
                "Small, hands-on projects help turn new knowledge into a skill you can use.",
              ],
              [
                MessageCircle,
                "Get support along the way",
                "When available, community and expert feedback offer another perspective on your work.",
              ],
            ].map(([Icon, title, copy]: any, i) => (
              <article
                className="card"
                key={title as string}
                style={{ padding: 25 }}
              >
                <div className="eyebrow">0{i + 1} / the approach</div>
                <div style={{ marginTop: 28, color: "#6657e8" }}>
                  <Icon size={24} />
                </div>
                <h2
                  className="font-display"
                  style={{
                    fontSize: 22,
                    letterSpacing: "-.04em",
                    margin: "15px 0 8px",
                  }}
                >
                  {title}
                </h2>
                <p className="muted" style={{ fontSize: 14, margin: 0 }}>
                  {copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section style={{ background: "#eef0f7", padding: "72px 0" }}>
        <div
          className="wrap"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 30,
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="eyebrow">Find your own pace</span>
            <h2 className="display" style={{ fontSize: 40, margin: "10px 0" }}>
              Curiosity is a good starting point.
            </h2>
          </div>
          <Link href="/courses" className="btn">
            Explore courses <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
