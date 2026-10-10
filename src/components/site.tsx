"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X, ArrowRight } from "lucide-react";
import { getData } from "@/lib/ui";
import { AiSupportAssistant } from "@/components/ai-support";

export function Wordmark({
  light = false,
  compact = false,
}: {
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="Riches AI Network home"
      className="wordmark"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        color: light ? "#f7f7ff" : "var(--forest)",
      }}
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 42 42"
        role="img"
        aria-label="Ascending learning path"
        fill="none"
      >
        <path
          d="M6 31h9V22h9V13h12"
          stroke={light ? "#D8D4FF" : "#6657E8"}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6" cy="31" r="3" fill={light ? "#D8D4FF" : "#6657E8"} />
        <circle cx="15" cy="22" r="3" fill={light ? "#D8D4FF" : "#6657E8"} />
        <circle cx="24" cy="13" r="3" fill={light ? "#D8D4FF" : "#6657E8"} />
        <circle
          cx="36"
          cy="13"
          r="4"
          fill="#6657E8"
          stroke={light ? "#D8D4FF" : "#6657E8"}
          strokeWidth="2"
        />
      </svg>
      <span style={{ lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-.04em",
          }}
        >
          RICHES AI
        </span>
        {!compact && (
          <span
            className="wordmark-sub"
            style={{
              display: "block",
              fontSize: 9,
              letterSpacing: ".21em",
              marginTop: 5,
              fontWeight: 600,
            }}
          >
            NETWORK
          </span>
        )}
      </span>
    </Link>
  );
}
const nav = [
  ["Courses", "/courses"],
  ["Membership", "/membership"],
  ["Mentorship", "/mentorship"],
  ["Our approach", "/about"],
  ["Contact", "/contact"],
];
export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  useEffect(() => {
    getData("me")
      .then((result) => setSession(result.data || null))
      .catch(() => setSession(null));
  }, []);
  const signedIn = Boolean(session?.user);
  return (
    <header className="public-nav">
      <div className="wrap nav-inner">
        <Wordmark />
        <nav className="nav-links" aria-label="Main navigation">
          {nav.map(([name, href]) => (
            <Link key={href} href={href}>
              {name}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          {!signedIn && (
            <Link
              href="/login"
              className="nav-login"
              style={{ fontSize: 13, fontWeight: 700 }}
            >
              Log in
            </Link>
          )}
          <Link href={signedIn ? "/dashboard" : "/register"} className="btn btn-small">
            {signedIn ? "Dashboard" : "Get started"} <ArrowUpRight size={15} />
          </Link>
          <button
            className="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {open && (
          <nav className="mobile-nav-open" aria-label="Mobile navigation">
            {nav.map(([name, href]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                {name}
              </Link>
            ))}
            {!signedIn && <Link href="/login" onClick={() => setOpen(false)}>Log in</Link>}
            <Link
              href={signedIn ? "/dashboard" : "/register"}
              onClick={() => setOpen(false)}
              style={{ color: "#5748d1" }}
            >
              {signedIn ? "Open dashboard" : "Create a free account"} <ArrowRight size={15} />
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Wordmark light />
            <p
              style={{
                maxWidth: 330,
                color: "#d2dbd1",
                fontSize: 14,
                marginTop: 20,
              }}
            >
              Practical AI learning for people building their next chapter—one
              useful skill at a time.
            </p>
          </div>
          <div className="footer-links">
            <strong
              style={{
                color: "white",
                fontSize: 12,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              Explore
            </strong>
            <Link href="/courses">Free courses</Link>
            <Link href="/membership">Membership</Link>
            <Link href="/mentorship">Mentorship</Link>
            <Link href="/about">Our approach</Link>
          </div>
          <div className="footer-links">
            <strong
              style={{
                color: "white",
                fontSize: 12,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              Your account
            </strong>
            <Link href="/login">Log in</Link>
            <Link href="/register">Create account</Link>
            <Link href="/contact">Contact us</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Riches AI Network</span>
          <span>Learn with intention. Build with confidence.</span>
        </div>
      </div>
    </footer>
  );
}
export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
      <AiSupportAssistant mode="public" />
    </>
  );
}
export function HomeArtwork({ imageUrl }: { imageUrl: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="hero-visual"
      aria-label="A visual metaphor for a learning path"
      role="img"
      style={{
        backgroundColor: "#eef0f7",
        backgroundImage:
          imageUrl && !failed
            ? `linear-gradient(90deg,#eef0f718,#eef0f708),url(${imageUrl})`
            : undefined,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      {(!imageUrl || failed) && (
        <>
          <span className="hero-sun" />
          <span className="hero-orbit" />
          <svg
            className="hero-path"
            viewBox="0 0 500 240"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 212C103 211 94 146 191 145s91-48 159-48 74-55 140-78"
              stroke="#6657e8"
              strokeWidth="2"
              strokeDasharray="6 9"
              opacity=".45"
            />
            <path
              d="M10 212C103 211 94 146 191 145s91-48 159-48 74-55 140-78"
              stroke="#6657e8"
              strokeWidth="1"
              opacity=".6"
            />
            <circle cx="14" cy="212" r="11" fill="#6657e8" />
            <circle
              cx="190"
              cy="145"
              r="13"
              fill="#c4beff"
              stroke="#6657e8"
              strokeWidth="2"
            />
            <circle
              cx="350"
              cy="97"
              r="13"
              fill="#fffefa"
              stroke="#6657e8"
              strokeWidth="2"
            />
            <circle
              cx="490"
              cy="18"
              r="15"
              fill="#c4beff"
              stroke="#6657e8"
              strokeWidth="2"
            />
          </svg>
          <div className="hero-panel hero-panel-a">
            <span className="eyebrow" style={{ fontSize: 9 }}>
              YOUR NEXT IDEA
            </span>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              Start with a prompt.
            </div>
          </div>
          <div className="hero-panel hero-panel-b">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 50,
                  background: "#e5e1ff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                }}
              >
                02
              </span>
              <span className="eyebrow" style={{ fontSize: 9 }}>
                BUILD ON IT
              </span>
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.4,
                margin: "12px 0 2px",
                color: "#365242",
              }}
            >
              Learn a little. Make something real.
            </p>
          </div>
          <div className="hero-stamp">
            Learn
            <br />·<br />
            Make
            <br />·<br />
            Grow
          </div>
        </>
      )}
      {imageUrl && !failed && (
        <img
          src={imageUrl}
          alt="A visual representation of a creative learning space"
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        />
      )}
    </div>
  );
}
