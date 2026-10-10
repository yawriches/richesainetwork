import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Compass,
  Headphones,
  MessageSquareText,
  MoveUpRight,
  UsersRound,
} from "lucide-react";
import { CourseCards } from "@/components/public-data";
import { HERO_IMAGE_URL } from "@/lib/brand";
import { HomeArtwork } from "@/components/site";
import { readPublic } from "@/lib/catalog";

const skillAreas = [
  "AI Video",
  "Graphics",
  "Photography",
  "Automation",
  "Content Creation",
];

export default async function Home() {
  const catalog = await readPublic("courses", { access: "FREE" });
  const settings = await readPublic("settings");
  const communityFlag = await readPublic("community_enabled");
  const communityEnabled = communityFlag.data[0]?.enabled !== false;
  const config = Object.fromEntries(settings.data.map((s) => [s.key, s.value]));
  const testimonials = Array.isArray(config["public.testimonials"])
    ? config["public.testimonials"]
        .filter(
          (t) => t && typeof t.quote === "string" && typeof t.name === "string",
        )
        .slice(0, 6)
    : [];
  return (
    <>
      <section style={{ padding: "58px 0 72px", overflow: "hidden" }}>
        <div
          className="wrap home-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: ".94fr 1.06fr",
            alignItems: "center",
            gap: "clamp(36px,6vw,88px)",
          }}
        >
          <div>
            <span
              className="eyebrow"
              style={{ display: "inline-flex", alignItems: "center", gap: 9 }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: "#8b80ef",
                }}
              />{" "}
              A learning network for what comes next
            </span>
            <h1
              className="display site-headline"
              style={{ margin: "24px 0 23px", maxWidth: 600 }}
            >
              {config["home.hero_title"] ||
                "Learn AI. Build skills. Create your next chapter."}
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.65,
                maxWidth: 490,
                color: "#6f7280",
                marginBottom: 28,
              }}
            >
              {config["home.hero_description"] ||
                "Turn new ideas into practical skills—with guided courses, hands-on practice, and support when you need it."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="btn" href="#free-courses">
                Explore free courses <ArrowRight size={16} />
              </Link>
              <Link className="btn btn-outline" href="/about">
                How it works <ArrowUpRight size={15} />
              </Link>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 25,
                fontSize: 12,
                color: "#777a87",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 50,
                  background: "#e9e5ff",
                  color: "#5748d1",
                }}
              >
                <Compass size={15} />
              </span>
              Begin with curiosity. Build at your own pace.
            </div>
          </div>
          <HomeArtwork imageUrl={HERO_IMAGE_URL} />
        </div>
      </section>
      <section style={{ padding: "10px 0 46px" }}>
        <div className="wrap">
          <div style={{ maxWidth: 700, marginBottom: 18 }}>
            <span className="eyebrow">Explore skills</span>
            <h2
              className="font-display"
              style={{ fontSize: 23, margin: "8px 0" }}
            >
              A few directions your learning can take.
            </h2>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              These are learning areas to explore—not a claim that a course in
              each area is currently published.
            </p>
          </div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {skillAreas.map((area) => (
              <span className="pill" key={area}>
                {area}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section id="free-courses" style={{ padding: "28px 0 88px" }}>
        <div className="wrap">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "end",
              gap: 20,
              marginBottom: 27,
            }}
          >
            <div>
              <span className="eyebrow">A thoughtful place to start</span>
              <h2
                className="display"
                style={{ fontSize: "clamp(34px,4vw,52px)", margin: "12px 0 0" }}
              >
                Learn something useful.
              </h2>
            </div>
            <Link href="/courses" className="btn btn-plain">
              Browse courses <ArrowRight size={16} />
            </Link>
          </div>
          {catalog.configured && !catalog.error && catalog.data.length === 0 ? (
            <div className="soft-panel">
              <strong>No free courses are published right now.</strong>
              <p className="muted">
                The catalogue can also include courses with other access
                options. Browse the full published catalogue for current
                details.
              </p>
              <Link
                href="/courses"
                className="link-under"
                style={{
                  display: "inline-flex",
                  marginTop: 10,
                  fontWeight: 700,
                }}
              >
                Browse all courses <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <CourseCards
              data={catalog.data}
              catalogConfigured={catalog.configured}
              error={catalog.error}
            />
          )}
        </div>
      </section>
      <section style={{ background: "#eef0f7", padding: "86px 0" }}>
        <div className="wrap">
          <div style={{ maxWidth: 620, marginBottom: 40 }}>
            <span className="eyebrow">Your learning, with momentum</span>
            <h2
              className="display"
              style={{
                fontSize: "clamp(38px,5vw,64px)",
                margin: "14px 0 16px",
              }}
            >
              From first prompt to confident practice.
            </h2>
            <p className="muted" style={{ fontSize: 16, maxWidth: 530 }}>
              AI skills grow through trying, making, and reflecting. We help you
              move through each part of the journey.
            </p>
          </div>
          <div className="grid-3">
            {[
              {
                n: "01",
                title: "Learn",
                body: "Follow clear, approachable lessons built around real tools and ideas.",
                icon: BookOpen,
              },
              {
                n: "02",
                title: "Practice",
                body: "Try what you’ve learned and shape it into a project of your own.",
                icon: Compass,
              },
              {
                n: "03",
                title: "Grow",
                body: "Get constructive feedback and expert support as you take your next step.",
                icon: Headphones,
              },
            ].map((x) => (
              <article
                key={x.n}
                style={{ padding: "25px 0 0", borderTop: "1px solid #c7cec2" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span className="eyebrow">{x.n} / pathway</span>
                  <x.icon size={20} color="#315344" />
                </div>
                <h3
                  className="font-display"
                  style={{
                    fontSize: 25,
                    letterSpacing: "-.04em",
                    margin: "24px 0 8px",
                  }}
                >
                  {x.title}
                </h3>
                <p
                  className="muted"
                  style={{ margin: 0, maxWidth: 300, fontSize: 14 }}
                >
                  {x.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section-sm" style={{ background: "#fffefa" }}>
        <div className="wrap">
          <div style={{ maxWidth: 700, marginBottom: 28 }}>
            <span className="eyebrow">Different ways to get feedback</span>
            <h2
              className="display"
              style={{ fontSize: "clamp(34px,4vw,50px)", margin: "12px 0" }}
            >
              Choose the kind of support you need.
            </h2>
          </div>
          <div className="grid-2">
            <article className="card" style={{ padding: 24 }}>
              <span className="badge badge-yellow">
                <MessageSquareText size={15} /> Asynchronous
              </span>
              <h3
                className="font-display"
                style={{ fontSize: 24, margin: "16px 0 7px" }}
              >
                Practice reviews
              </h3>
              <p className="muted" style={{ fontSize: 14 }}>
                Share a project and a focused question for written feedback.
                Reviews are handled asynchronously—not a live appointment.
              </p>
              <Link
                href="/reviews"
                className="link-under"
                style={{
                  display: "inline-flex",
                  gap: 7,
                  alignItems: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Explore practice reviews <ArrowRight size={15} />
              </Link>
            </article>
            <article className="card" style={{ padding: 24 }}>
              <span className="badge">
                <Headphones size={15} /> 1:1 session
              </span>
              <h3
                className="font-display"
                style={{ fontSize: 24, margin: "16px 0 7px" }}
              >
                Expert support
              </h3>
              <p className="muted" style={{ fontSize: 14 }}>
                Meet one-to-one with an expert for a conversation about your
                next step. Packages and open appointment times are shown when
                available.
              </p>
              <Link
                href="/support"
                className="link-under"
                style={{
                  display: "inline-flex",
                  gap: 7,
                  alignItems: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                See expert support <ArrowRight size={15} />
              </Link>
            </article>
          </div>
        </div>
      </section>
      {communityEnabled && <section className="section">
        <div className="wrap home-community-grid">
          <div>
            <span className="eyebrow">A network, not just a playlist</span>
            <h2
              className="display"
              style={{
                fontSize: "clamp(38px,5vw,60px)",
                margin: "14px 0 18px",
              }}
            >
              Build with people in your corner.
            </h2>
            <p className="muted" style={{ fontSize: 15, maxWidth: 410 }}>
              Practical learning can feel personal and connected. Find a steady
              pace, get thoughtful feedback, and discover resources alongside a
              community of makers.
            </p>
            <Link href="/register" className="btn" style={{ marginTop: 14 }}>
              Find your starting point <ArrowRight size={16} />
            </Link>
          </div>
          <div
            className="card"
            style={{ padding: "32px 34px", background: "#fffefa" }}
          >
            <div
              style={{
                display: "flex",
                gap: 18,
                alignItems: "flex-start",
                paddingBottom: 22,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span className="badge badge-yellow">
                <UsersRound size={16} />
              </span>
              <div>
                <strong className="font-display" style={{ fontSize: 19 }}>
                  Practice with purpose
                </strong>
                <p
                  className="muted"
                  style={{ fontSize: 13, margin: "5px 0 0" }}
                >
                  Make small projects that connect to your goals and interests.
                </p>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 18,
                alignItems: "flex-start",
                paddingTop: 22,
              }}
            >
              <span className="badge">
                <MoveUpRight size={16} />
              </span>
              <div>
                <strong className="font-display" style={{ fontSize: 19 }}>
                  Choose your next step
                </strong>
                <p
                  className="muted"
                  style={{ fontSize: 13, margin: "5px 0 0" }}
                >
                  Explore courses first. Add support and community when it feels
                  right.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>}
      {testimonials.length > 0 && (
        <section className="section-sm">
          <div className="wrap">
            <span className="eyebrow">From our learners</span>
            <h2 className="display" style={{ fontSize: 42 }}>
              Real learning. In their words.
            </h2>
            <div className="grid-3">
              {testimonials.map((t, i) => (
                <blockquote
                  key={i}
                  className="card"
                  style={{ padding: 25, margin: 0 }}
                >
                  <p>“{t.quote}”</p>
                  <footer>
                    <strong>{t.name}</strong>
                    {t.role && <p className="field-hint">{t.role}</p>}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}
      <section style={{ padding: "0 0 100px" }}>
        <div className="wrap">
          <div
            style={{
              padding: "43px 48px",
              borderRadius: 24,
              background: "var(--forest)",
              color: "white",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 30,
              flexWrap: "wrap",
            }}
          >
            <div>
              <span className="eyebrow" style={{ color: "#d8d4ff" }}>
                Start where you are
              </span>
              <h2
                className="display"
                style={{
                  fontSize: "clamp(32px,4vw,49px)",
                  margin: "10px 0 6px",
                }}
              >
                Your next step can be a small one.
              </h2>
              <p style={{ margin: 0, color: "#e1e0f4" }}>
                Explore the learning paths and see what speaks to you.
              </p>
            </div>
            <Link className="btn btn-light" href="#free-courses">
              Explore free courses <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
