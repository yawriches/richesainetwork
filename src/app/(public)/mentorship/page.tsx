import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDotDashed, Clock3, Sparkles } from "lucide-react";
import { MentorshipApplication } from "@/components/mentorship-application";
import { readPublic } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "AI-to-Income Mentorship",
  description: "Apply for a focused six-week, one-on-one AI-to-Income Mentorship with Riches AI Network.",
};

const weeks = [
  ["01", "Clarity", "Identify the problem, audience, practical direction, and a focused outcome for the six weeks."],
  ["02", "Positioning", "Shape the offer, message, and proof you need before building more tools or content."],
  ["03", "Build", "Turn the strongest idea into a practical AI-assisted workflow, asset, or early service."],
  ["04", "Refine", "Test what is working, reduce friction, and make the work more useful for a real person or use case."],
  ["05", "Share", "Prepare a clear way to explain, demonstrate, and begin putting the work in front of the right people."],
  ["06", "Continue", "Review what changed, document the next actions, and leave with a realistic plan to keep building."],
];

export default async function MentorshipPage() {
  const countries = await readPublic("countries");
  return (
    <>
      <section className="mentorship-hero">
        <div className="wrap mentorship-hero-grid">
          <div>
            <span className="eyebrow mentorship-eyebrow"><Sparkles size={14} /> Private mentorship</span>
            <h1 className="display">Build an AI offer you can stand behind.</h1>
            <p>
              AI-to-Income Mentorship is a focused, six-week one-on-one working partnership for people ready to turn practical AI capability into a clearer direction, offer, or workflow.
            </p>
            <div className="mentorship-hero-actions">
              <Link className="btn" href="#apply">Apply for mentorship <ArrowRight size={16} /></Link>
              <Link className="btn btn-outline" href="/membership">Explore membership</Link>
            </div>
            <p className="mentorship-hero-note"><CircleDotDashed size={15} /> Application only. No price, place, payment, or income outcome is promised on this page.</p>
          </div>
          <aside className="mentorship-hero-card">
            <span className="eyebrow">The working rhythm</span>
            <strong>Six weeks. One direction. Personal feedback.</strong>
            <div className="mentorship-hero-stat"><Clock3 size={17} /><span>Built around the time you can realistically commit each week.</span></div>
            <div className="mentorship-hero-stat"><CheckCircle2 size={17} /><span>Application review before any invitation, payment, or onboarding conversation.</span></div>
          </aside>
        </div>
      </section>

      <section className="section mentorship-fit-section">
        <div className="wrap mentorship-fit-grid">
          <div>
            <span className="eyebrow">Who it is for</span>
            <h2 className="display">For people who are ready to work on something real.</h2>
            <p className="muted">You do not need to arrive with a finished business. You do need a genuine problem, idea, or direction you are prepared to explore with focus.</p>
          </div>
          <div className="mentorship-fit-list">
            <p><CheckCircle2 size={17} /> You want practical AI capability, not another passive content library.</p>
            <p><CheckCircle2 size={17} /> You can make room for consistent work, reflection, and feedback over six weeks.</p>
            <p><CheckCircle2 size={17} /> You are willing to test, improve, and make decisions rather than wait for a perfect plan.</p>
            <p><CheckCircle2 size={17} /> You understand that guidance can strengthen your work, but it cannot guarantee income.</p>
          </div>
        </div>
      </section>

      <section className="mentorship-weeks-section">
        <div className="wrap">
          <div className="mentorship-section-heading">
            <div>
              <span className="eyebrow">A six-week working outline</span>
              <h2 className="display">Move from scattered ideas to a useful next chapter.</h2>
            </div>
            <p className="muted">The precise work is shaped around the accepted participant, their starting point, and the project they bring.</p>
          </div>
          <div className="mentorship-week-grid">
            {weeks.map(([number, title, body]) => (
              <article className="mentorship-week-card" key={number}>
                <span>{number}</span>
                <h3 className="font-display">{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="apply">
        <div className="wrap mentorship-application-layout">
          <div className="mentorship-application-copy">
            <span className="eyebrow">Apply with intention</span>
            <h2 className="display">The right next step begins with an honest starting point.</h2>
            <p className="muted">Applications are reviewed privately. If there is a potential fit, the team will follow up with the next conversation and any investment details. If not, there is no payment obligation.</p>
            <div className="mentorship-application-boundary">
              <strong>What happens after you apply</strong>
              <ol>
                <li>The team reviews your application.</li>
                <li>You may be invited for a follow-up conversation or asked for more context.</li>
                <li>Only a manual acceptance leads to next-step and payment discussions.</li>
              </ol>
            </div>
          </div>
          <MentorshipApplication countries={countries.data} />
        </div>
      </section>
    </>
  );
}
