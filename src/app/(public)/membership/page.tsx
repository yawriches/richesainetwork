import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PlanCards } from "@/components/public-data";
import { readPublic } from "@/lib/catalog";
export const metadata: Metadata = {
  title: "Membership",
  description: "Explore Riches AI Network membership when plans are available.",
};
export default async function Membership() {
  const plans = await readPublic("membership_plans");
  return (
    <>
      <section className="section-sm">
        <div className="wrap">
          <span className="eyebrow">Support for your next step</span>
          <h1
            className="display"
            style={{
              fontSize: "clamp(46px,7vw,82px)",
              maxWidth: 780,
              margin: "15px 0 20px",
            }}
          >
            A little more support, when you want it.
          </h1>
          <p className="muted" style={{ maxWidth: 600, fontSize: 16 }}>
            Membership can bring learning resources, expert feedback, and a
            community into one place. Review what’s included before deciding
            whether it fits.
          </p>
        </div>
      </section>
      <section style={{ padding: "18px 0 58px" }}>
        <div className="wrap">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 23,
              color: "#777a87",
              fontSize: 13,
            }}
          >
            <ShieldCheck size={17} /> Published plans and prices are supplied by
            the network—not guessed here.
          </div>
          <PlanCards
            data={plans.data}
            catalogConfigured={plans.configured}
            error={plans.error}
          />
        </div>
      </section>
      <section className="section-sm" style={{ background: "#eef0f7" }}>
        <div className="wrap" style={{ maxWidth: 850, textAlign: "center" }}>
          <span className="eyebrow">No rush to decide</span>
          <h2 className="display" style={{ fontSize: 42, margin: "12px 0" }}>
            Start with learning for free.
          </h2>
          <p className="muted">
            You can explore the course catalogue without choosing a membership.
          </p>
          <Link href="/courses" className="btn" style={{ marginTop: 14 }}>
            Browse courses <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
