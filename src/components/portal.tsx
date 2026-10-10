"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flag,
  Heart,
  Headphones,
  Home,
  LogOut,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  UsersRound,
  Bell,
  FileUp,
  ImagePlus,
  Send,
  Trash2,
  X,
  Clapperboard,
  Receipt,
  Store,
} from "lucide-react";
import { Wordmark } from "@/components/site";
import { AiSupportAssistant } from "@/components/ai-support";
import { LessonVideo } from "@/components/lesson-video";
import { uploadCommunityVideo } from "@/lib/bunny-upload";
import { ReviewCreditPurchase } from "@/components/purchase-panel";
import {
  asArray,
  formatDate,
  getData,
  humanize,
  money,
  postAction,
  safeResourceHref,
  text,
} from "@/lib/ui";

const studentNav = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/learn", label: "My learning", icon: BookOpen },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/mentorship", label: "Mentorship", icon: Sparkles },
  { href: "/reviews", label: "Practice reviews", icon: MessageSquareText },
  { href: "/support", label: "Expert support", icon: Headphones },
  { href: "/community", label: "Community", icon: UsersRound },
  { href: "/account", label: "Account", icon: Settings },
];
// Phone bottom bar: four everyday destinations plus "More".
const mobilePrimaryNav = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/marketplace", label: "Courses", icon: Store },
  { href: "/reviews", label: "Practice", icon: MessageSquareText },
];
const mobileMoreNav = [
  { href: "/community", label: "Community", hint: "Posts, drops and events", icon: UsersRound },
  { href: "/mentorship", label: "Mentorship", hint: "6-week AI-to-Income programme", icon: Sparkles },
  { href: "/support", label: "Expert support", hint: "Book 1-on-1 help", icon: Headphones },
  { href: "/notifications", label: "Notifications", hint: "Updates and reminders", icon: Bell },
  { href: "/account/purchases", label: "Purchases", hint: "Orders and receipts", icon: Receipt },
  { href: "/account", label: "Account", hint: "Profile and preferences", icon: Settings },
];
const extract = (v: any, key: string) =>
  Array.isArray(v) ? v : asArray(v?.[key]);
function Notice({
  children,
  type = "note",
}: {
  children: ReactNode;
  type?: "note" | "error" | "success";
}) {
  return (
    <div
      className={
        type === "error"
          ? "form-alert"
          : type === "success"
            ? "form-alert form-success"
            : "soft-panel"
      }
      style={{ fontSize: 13 }}
      role={type === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
function Empty({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="soft-panel">
      <strong>{title}</strong>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
        {body}
      </p>
      {href && (
        <Link
          className="link-under"
          href={href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 13,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {label || "Continue"}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  desc,
  action,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "end",
        gap: 18,
        flexWrap: "wrap",
        marginBottom: 28,
      }}
    >
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1
          className="display"
          style={{ fontSize: "clamp(36px,5vw,58px)", margin: "10px 0 7px" }}
        >
          {title}
        </h1>
        {desc && (
          <p className="muted" style={{ margin: 0, maxWidth: 680 }}>
            {desc}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
function QueryState({
  loading,
  error,
  configured,
  children,
}: {
  loading: boolean;
  error?: string;
  configured: boolean;
  children: ReactNode;
}) {
  if (loading)
    return (
      <p className="loading" aria-live="polite">
        Loading your information…
      </p>
    );
  if (error) return <Notice type="error">{error}</Notice>;
  if (!configured)
    return (
      <Notice>
        Your personal workspace is connecting to the network. Please try again
        shortly.
      </Notice>
    );
  return <>{children}</>;
}

export function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [communityEnabled, setCommunityEnabled] = useState(false);
  const [signOut, setSignOut] = useState(false);
  const [search, setSearch] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [moreOpen]);
  useEffect(() => {
    getData("me")
      .then(async (r) => {
        setSession(r.data || null);
        if (r.data?.user) {
          const community = await getData("community_access").catch(() => ({ data: null }));
          setCommunityEnabled(Boolean(community.data?.community_enabled));
        }
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);
  const logout = async () => {
    setSignOut(true);
    await postAction("logout", {});
    router.push("/login");
    router.refresh();
  };
  if (!checked)
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <Wordmark />
          <p className="loading">Opening your learning space…</p>
        </div>
      </div>
    );
  if (!session?.user)
    return (
      <div className="auth-wrap">
        <section className="card auth-card">
          <Wordmark />
          <span className="eyebrow" style={{ display: "block", marginTop: 30 }}>
            A personal learning space
          </span>
          <h1 className="display" style={{ fontSize: 36, margin: "10px 0" }}>
            Sign in to continue.
          </h1>
          <p className="muted">
            Your progress, practice reviews, and account details are available
            after you sign in.
          </p>
          <Link className="btn" href="/login" style={{ marginTop: 16 }}>
            Log in <ArrowRight size={16} />
          </Link>
          <p className="field-hint" style={{ marginTop: 14 }}>
            New here?{" "}
            <Link className="link-under" href="/register">
              Create a free account
            </Link>
          </p>
        </section>
      </div>
    );
  const active = pathname.startsWith("/learn/")
    ? "/learn"
    : pathname.startsWith("/reviews/")
      ? "/reviews"
      : pathname.startsWith("/marketplace/")
        ? "/marketplace"
        : pathname.startsWith("/community/")
        ? "/community"
        : pathname.startsWith("/account/")
          ? "/account"
          : pathname;
  const accountRole = String(session.profile?.role || "").toUpperCase();
  return (
    <div className="portal-shell">
      <aside className="portal-side">
        <Wordmark />
        <div>
          <div
            className="eyebrow"
            style={{ padding: "0 12px", marginBottom: 9 }}
          >
            Your learning space
          </div>
          <nav className="portal-nav" aria-label="Learning navigation">
            {studentNav.filter((n) => communityEnabled || n.href !== "/community").map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active === n.href ? "page" : undefined}
              >
                <n.icon size={17} />
                {n.label}
              </Link>
            ))}
            {String(session.profile?.role || "").toUpperCase() === "ADMIN" && (
              <Link href="/admin">
                <Shield size={17} />
                Admin centre
              </Link>
            )}
          </nav>
        </div>
        <div className="soft-panel" style={{ marginTop: "auto", padding: 15 }}>
          <div className="eyebrow">A steady pace</div>
          <p style={{ fontSize: 12, margin: "7px 0 12px", color: "#777a87" }}>
            Small, regular steps make room for new skills.
          </p>
          <button
            className="btn btn-outline btn-small"
            onClick={logout}
            disabled={signOut}
            style={{ width: "100%" }}
          >
            <LogOut size={15} />
            {signOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </aside>
      <main className="portal-main">
        <div className="portal-topbar">
          {pathname.startsWith("/marketplace") ? <span /> : <form
            className="portal-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const value = search.trim();
              router.push(value ? `/marketplace?search=${encodeURIComponent(value)}` : "/marketplace");
            }}
          >
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search courses, resources..."
              aria-label="Search courses and resources"
            />
          </form>}
          <div className="portal-topbar-actions">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="icon-button portal-notification"
            >
              <Bell size={16} />
            </Link>
            <span className="portal-divider" aria-hidden="true" />
            <div className="portal-user-chip">
              <span className="portal-avatar">
                {text(session.profile?.name, "L").slice(0, 1).toUpperCase()}
              </span>
              <span className="portal-user-copy">
                <strong>{text(session.profile?.name, "Learner")}</strong>
                <small>{accountRole === "ADMIN" ? "Administrator" : "Learner"}</small>
              </span>
            </div>
          </div>
        </div>
        {children}
      </main>
      <nav
        className="student-bottom-nav"
        aria-label="Mobile learning navigation"
      >
        {mobilePrimaryNav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active === n.href ? "page" : undefined}
          >
            <n.icon size={18} />
            <span>{n.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className="student-bottom-more"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={!moreOpen && mobileMoreNav.some((n) => n.href === active) ? "page" : undefined}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <MoreHorizontal size={18} />
          <span>More</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="student-more-layer" onClick={() => setMoreOpen(false)}>
          <div
            className="student-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More sections"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="student-more-head">
              <strong>More</strong>
              <button type="button" className="icon-button icon-button-small" aria-label="Close" onClick={() => setMoreOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="student-more-list">
              {mobileMoreNav.filter((n) => communityEnabled || n.href !== "/community").map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active === n.href ? "page" : undefined}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="student-more-icon"><n.icon size={17} /></span>
                  <span className="student-more-copy">
                    <strong>{n.label}</strong>
                    <small>{n.hint}</small>
                  </span>
                  <ChevronRight size={16} />
                </Link>
              ))}
              {accountRole === "ADMIN" && (
                <Link href="/admin" onClick={() => setMoreOpen(false)}>
                  <span className="student-more-icon"><Shield size={17} /></span>
                  <span className="student-more-copy">
                    <strong>Admin centre</strong>
                    <small>Manage the platform</small>
                  </span>
                  <ChevronRight size={16} />
                </Link>
              )}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-small student-more-logout"
              onClick={logout}
              disabled={signOut}
            >
              <LogOut size={15} />
              {signOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        </div>
      )}
      <AiSupportAssistant mode="learner" />
    </div>
  );
}

export function StudentView({
  page,
  courseId,
}: {
  page: string;
  courseId?: string;
}) {
  if (page === "dashboard") return <Dashboard />;
  if (page === "learn") return <LearningList />;
  if (page === "course") return <CoursePlayer courseId={courseId || ""} />;
  if (page === "reviews") return <Reviews />;
  if (page === "new-review") return <NewReview />;
  if (page === "support") return <Support />;
  if (page === "community") return <Community type="all" />;
  if (page === "drops") return <Community type="drops" />;
  if (page === "events") return <Community type="events" />;
  if (page === "account") return <Account />;
  if (page === "purchases") return <Purchases />;
  if (page === "notifications") return <Notifications />;
  return (
    <Empty
      title="This page isn’t available."
      body="Choose a section from your learning navigation."
      href="/dashboard"
      label="Return to overview"
    />
  );
}

function Dashboard() {
  const [q, setQ] = useState<any>({ loading: true, configured: true });
  useEffect(() => {
    Promise.all([getData("dashboard"), getData("community_access")])
      .then(([dashboard, community]) => setQ({ loading: false, ...dashboard, data: { ...(dashboard.data || {}), community_enabled: Boolean(community.data?.community_enabled) } }))
      .catch(() =>
        setQ({ loading: false, error: "Your dashboard could not be loaded." }),
      );
  }, []);
  const d = q.data || {};
  const communityEnabled = Boolean(d.community_enabled);
  const enrollments = extract(d.enrollments, "enrollments");
  const reviews = extract(d.reviews, "reviews");
  const appointments = extract(d.appointments, "appointments");
  const events = communityEnabled ? extract(d.events, "events") : [];
  const drops = communityEnabled ? extract(d.ai_drops, "ai_drops") : [];
  const notifications = extract(d.notifications, "notifications");
  const announcements = communityEnabled ? extract(d.announcements, "announcements") : [];
  const recognitions = extract(d.recognition ?? d.recognitions, "recognitions");
  const reviewBalance = Number(d.reviewBalance ?? 0);
  const profile = d.profile || {};
  const recommended = asArray(d.recommended_courses)[0];
  const availableCourses = asArray(d.available_courses);
  const discoveryCourses = (enrollments.length
    ? availableCourses
    : [
        availableCourses.find((course: any) => course.access_type === "FREE"),
        availableCourses.find((course: any) => course.access_type === "PURCHASE"),
        ...availableCourses,
      ]
  ).filter(Boolean).filter(
    (course: any, index: number, all: any[]) =>
      all.findIndex((item) => item.id === course.id) === index,
  ).slice(0, 3);
  const unfinished = enrollments.find(
    (e: any) =>
      !e.completed_at && String(e.status || "").toUpperCase() !== "COMPLETED",
  );
  const learningProgress = enrollments.length
    ? Math.round(
        enrollments.reduce(
          (sum: number, e: any) => sum + Number(e.progress_percent || 0),
          0,
        ) / enrollments.length,
      )
    : 0;
  const nextHref = !profile.onboarded
    ? "/onboarding"
    : unfinished
      ? `/learn/${unfinished.course_id || unfinished.course?.id}`
      : !enrollments.length
        ? recommended
          ? `/courses/${recommended.slug}`
          : "/courses"
        : reviewBalance > 0
          ? "/reviews/new"
          : communityEnabled
            ? "/community"
            : "/courses";
  const nextLabel = !profile.onboarded
    ? "Shape my learning path"
    : unfinished
      ? "Continue learning"
      : !enrollments.length
        ? recommended
          ? "Explore my starting course"
          : "Explore courses"
        : reviewBalance > 0
          ? "Submit work"
          : communityEnabled
            ? "Explore community"
            : "Explore courses";
  return (
    <QueryState
      loading={q.loading}
      error={q.error}
      configured={q.configured !== false}
    >
      <div className="dashboard-layout">
        <div className="dashboard-primary">
      <Heading
        eyebrow="Your learning journey"
        title={`Good to see you${profile.name ? `, ${profile.name.split(" ")[0]}` : ""}.`}
        desc="Choose one useful next step and keep moving at your own pace."
      />
      <section className="dashboard-hero"
        style={{
          background: "var(--forest)",
          color: "white",
          borderRadius: 22,
          padding: "28px 30px",
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr)",
          alignItems: "center",
          gap: 20,
          marginBottom: 27,
        }}
      >
        <div>
          <span className="eyebrow" style={{ color: "#d8d4ff" }}>
            Your next step
          </span>
          <h2
            className="font-display"
            style={{
              fontSize: 27,
              margin: "8px 0 5px",
              letterSpacing: "-.04em",
            }}
          >
            {!profile.onboarded
              ? "Make your learning yours"
              : unfinished
                ? `Continue ${text(unfinished.course?.title, "your course")}`
                : !enrollments.length
                  ? recommended
                    ? `Start with ${recommended.title}`
                    : "Find a course to begin"
                  : reviewBalance > 0
                    ? "Put your learning into practice"
                    : "Explore what’s happening"}
          </h2>
          <p style={{ fontSize: 13, color: "#d3ddd3", margin: 0 }}>
            {!profile.onboarded
              ? "Choose your interests, experience, and country."
              : unfinished
                ? "Pick up where you left off."
                : !enrollments.length
                  ? "Choose a published course that fits your interests."
                  : reviewBalance > 0
                    ? "Submit a project and request constructive feedback."
                    : communityEnabled
                      ? "Discover community resources and events."
                      : "Browse the course library for your next useful course."}
          </p>
        </div>
        <Link className="btn btn-light" href={nextHref}>
          {nextLabel} <ArrowRight size={15} />
        </Link>
      </section>
      <div className="dashboard-stat-strip grid-3" style={{ marginBottom: 28 }}>
        {[
          {
            label: "Courses in progress",
            value: enrollments.length,
            href: "/learn",
            icon: BookOpen,
          },
          {
            label: "Review credits",
            value: reviewBalance,
            href: "/reviews",
            icon: MessageSquareText,
          },
          {
            label: "Upcoming appointments",
            value: appointments.length,
            href: "/support",
            icon: CalendarDays,
          },
        ].map((x) => (
          <Link href={x.href} className="card stat-card" key={x.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#777a87",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {x.label}
              <x.icon size={16} />
            </div>
            <div className="stat-value">
              {Number.isFinite(Number(x.value)) ? x.value : 0}
            </div>
          </Link>
        ))}
      </div>
      <div className="dashboard-sections grid-2">
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h2 className="font-display" style={{ fontSize: 20, margin: 0 }}>
              Continue learning
            </h2>
            <Link className="field-hint link-under" href="/learn">
              All courses
            </Link>
          </div>
          {enrollments.length ? (
            enrollments.slice(0, 3).map((e: any) => (
              <Link
                href={`/learn/${e.course_id || e.course?.id}`}
                key={e.id}
                className="card"
                style={{ display: "block", padding: 18, marginBottom: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div className="dashboard-course-row">
                    <div className="course-thumb course-thumb-small">
                      {e.course?.thumbnail_url ? (
                        <img src={e.course.thumbnail_url} alt="" loading="lazy" />
                      ) : (
                        <BookOpen size={18} />
                      )}
                    </div>
                    <div>
                    <strong>
                      {text(e.course?.title, e.title || "Your course")}
                    </strong>
                    <p className="field-hint" style={{ margin: "5px 0 12px" }}>
                      {Number(e.progress_percent || 0)}% complete
                    </p>
                    </div>
                  </div>
                  <ChevronRight size={18} />
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${Math.max(0, Math.min(100, Number(e.progress_percent || 0)))}%`,
                    }}
                  />
                </div>
              </Link>
            ))
          ) : (
            <Empty
              title="Your learning starts with one course."
              body="Enrolled courses and real progress will appear here."
              href="/courses"
              label="Explore published courses"
            />
          )}
        </section>
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h2 className="font-display" style={{ fontSize: 20, margin: 0 }}>
              Your review balance
            </h2>
            <Link className="field-hint link-under" href="/reviews">
              Review history
            </Link>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: "#777a87" }}>
              Available submissions
            </div>
            <div className="stat-value" style={{ marginBottom: 12 }}>
              {reviewBalance}
            </div>
            {reviews.length ? (
              reviews.slice(0, 2).map((r: any) => (
                <div
                  className="lesson-row"
                  key={r.id}
                  style={{ paddingInline: 0 }}
                >
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13 }}>
                      {text(r.title, "Project review")}
                    </strong>
                    <div className="field-hint">
                      {text(r.status, "Status pending")}
                    </div>
                  </div>
                  <ChevronRight size={15} />
                </div>
              ))
            ) : (
              <p className="field-hint">
                New feedback and review status will appear here.
              </p>
            )}
          </div>
        </section>
        <section>
          <h2
            className="font-display"
            style={{ fontSize: 20, margin: "0 0 14px" }}
          >
            Membership
          </h2>
          <div className="card" style={{ padding: 20 }}>
            {d.membership?.plan_name ? (
              <>
                <span className="badge">
                  {text(d.membership.status, "Membership")}
                </span>
                <h3
                  className="font-display"
                  style={{ fontSize: 20, margin: "12px 0 4px" }}
                >
                  {d.membership.plan_name}
                </h3>
                <p className="field-hint">
                  {d.membership.ends_at
                    ? `Ends ${formatDate(d.membership.ends_at)}`
                    : "Membership details from your account."}
                </p>
                <Link
                  href="/account"
                  className="link-under"
                  style={{ fontSize: 12, fontWeight: 700 }}
                >
                  Manage membership
                </Link>
              </>
            ) : (
              <>
                <strong>No active membership</strong>
                <p className="field-hint">
                  You can explore learning without committing to a plan.
                </p>
                <Link
                  href="/membership"
                  className="link-under"
                  style={{ fontSize: 12, fontWeight: 700 }}
                >
                  See published options
                </Link>
              </>
            )}
          </div>
        </section>
        <section>
          <h2
            className="font-display"
            style={{ fontSize: 20, margin: "0 0 14px" }}
          >
            Around the network
          </h2>
          {appointments.length ||
          events.length ||
          drops.length ||
          notifications.length ||
          announcements.length ||
          recognitions.length ? (
            <div className="card" style={{ padding: 17 }}>
              {appointments.slice(0, 1).map((a: any) => {
                const href = safeResourceHref(a.meeting_url);
                return (
                  <div key={a.id} className="lesson-row" style={{ padding: 8 }}>
                    <CalendarDays size={16} />
                    <span style={{ fontSize: 12, flex: 1 }}>
                      {text(a.title, "Appointment")} · {formatDate(a.starts_at)}
                    </span>
                    {href && (
                      <a
                        className="link-under"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Meeting link
                      </a>
                    )}
                  </div>
                );
              })}
              {events.slice(0, 1).map((a: any) => {
                const href = safeResourceHref(a.meeting_url);
                return (
                  <div key={a.id} className="lesson-row" style={{ padding: 8 }}>
                    <UsersRound size={16} />
                    <span style={{ fontSize: 12, flex: 1 }}>
                      {text(a.title, "Community event")} ·{" "}
                      {formatDate(a.starts_at)}
                    </span>
                    {href && (
                      <a
                        className="link-under"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Join
                      </a>
                    )}
                  </div>
                );
              })}
              {drops.slice(0, 1).map((a: any) => {
                const href = safeResourceHref(a.resource_url || a.url);
                return (
                  <div key={a.id} className="lesson-row" style={{ padding: 8 }}>
                    <Sparkles size={16} />
                    <span style={{ fontSize: 12, flex: 1 }}>
                      {text(a.title, "AI drop")}
                    </span>
                    {href && (
                      <a
                        className="link-under"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    )}
                  </div>
                );
              })}
              {notifications.slice(0, 2).map((n: any) => {
                const href = safeResourceHref(n.url || n.href || n.link_url);
                return (
                  <div
                    key={`notification-${n.id}`}
                    className="lesson-row"
                    style={{ padding: 8 }}
                  >
                    <Bell size={16} />
                    <span style={{ fontSize: 12, flex: 1 }}>
                      {text(n.title, text(n.body, "Account update"))}
                    </span>
                    {href && (
                      <a
                        className="link-under"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    )}
                  </div>
                );
              })}
              {announcements.slice(0, 2).map((a: any) => {
                const href = safeResourceHref(a.url || a.href || a.link_url);
                return (
                  <div
                    key={`announcement-${a.id}`}
                    className="lesson-row"
                    style={{ padding: 8 }}
                  >
                    <Bell size={16} />
                    <span style={{ fontSize: 12, flex: 1 }}>
                      {text(a.title, "Network update")}
                    </span>
                    {href && (
                      <a
                        className="link-under"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Read
                      </a>
                    )}
                  </div>
                );
              })}
              {recognitions.slice(0, 2).map((r: any) => {
                const href = safeResourceHref(r.url || r.href || r.link_url);
                return (
                  <div
                    key={`recognition-${r.id}`}
                    className="lesson-row"
                    style={{ padding: 8 }}
                  >
                    <Sparkles size={16} />
                    <span style={{ fontSize: 12, flex: 1 }}>
                      {text(r.title, text(r.name, "Recognition"))}
                    </span>
                    {href && (
                      <a
                        className="link-under"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    )}
                  </div>
                );
              })}
              <Link
                className="link-under"
                href="/notifications"
                style={{
                  display: "inline-flex",
                  margin: "10px 8px 0",
                  fontSize: 12,
                }}
              >
                All updates
              </Link>
            </div>
          ) : (
            <Empty
              title="A space for what’s next."
              body={communityEnabled ? "Your confirmed appointments and available community updates will show here." : "Your confirmed appointments and account updates will show here."}
              href={communityEnabled ? "/community" : "/support"}
              label={communityEnabled ? "Visit community" : "Open support"}
            />
          )}
        </section>
      </div>
      {discoveryCourses.length > 0 && (
        <section className="dashboard-discovery">
          <div className="dashboard-section-heading">
            <div>
              <span className="eyebrow">Keep exploring</span>
              <h2 className="font-display">More useful courses for you.</h2>
            </div>
            <Link className="field-hint link-under" href="/courses">Browse all courses</Link>
          </div>
          <div className="dashboard-discovery-grid">
            {discoveryCourses.map((course: any) => (
              <Link href={`/courses/${course.slug}`} className="dashboard-discovery-card" key={course.id}>
                <div className="course-thumb">
                  {course.thumbnail_url ? <img src={course.thumbnail_url} alt="" loading="lazy" /> : <BookOpen size={20} />}
                </div>
                <div className="dashboard-discovery-copy">
                  <span className="badge">{text(course.access_type, "Course")}</span>
                  <strong>{text(course.title, "Published course")}</strong>
                  <span>{text(course.category, "AI skills")} · {humanize(course.level || "BEGINNER")}</span>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </section>
      )}
        </div>
        <aside className="dashboard-aside" aria-label="Learning analytics">
          <section className="card dashboard-progress-card">
            <div className="dashboard-card-heading">
              <strong>Learning progress</strong>
              <MoreHorizontal size={17} />
            </div>
            <div
              className="progress-ring"
              style={{
                background: `conic-gradient(var(--forest) ${learningProgress}%, #ececf4 0)`,
              }}
            >
              <div className="progress-ring-inner">
                <strong>{learningProgress}%</strong>
                <span>overall</span>
              </div>
            </div>
            <div className="dashboard-greeting">
              <strong>Keep your momentum going</strong>
              <span>Small, consistent steps build confident AI skills.</span>
            </div>
            <div className="dashboard-bars" aria-label="Learning activity summary">
              {[enrollments.length, reviews.length, appointments.length, notifications.length].map(
                (value, index) => (
                  <span
                    key={index}
                    style={{
                      height: `${Math.max(22, Math.min(86, Number(value) * 18 + 22))}%`,
                    }}
                  />
                ),
              )}
            </div>
            <div className="dashboard-bar-labels">
              <span>Learn</span>
              <span>Review</span>
              <span>Support</span>
              <span>Updates</span>
            </div>
          </section>
          {communityEnabled && <section className="card dashboard-mentor-card">
            <div className="dashboard-card-heading">
              <strong>Stay connected</strong>
              <Link
                href="/community"
                aria-label="Open community"
                className="icon-button icon-button-small"
              >
                <Plus size={15} />
              </Link>
            </div>
            <div className="dashboard-mentor-row">
              <span className="mentor-avatar">AR</span>
              <span>
                <strong>Riches AI Network</strong>
                <small>Learning community</small>
              </span>
            </div>
            <p className="field-hint" style={{ margin: "16px 0 18px" }}>
              Find practical ideas, announcements, and people building their next chapter.
            </p>
            <Link href="/community" className="dashboard-see-all">
              Visit community <ArrowRight size={14} />
            </Link>
          </section>}
        </aside>
      </div>
    </QueryState>
  );
}

function LearningList() {
  const [q, setQ] = useState<any>({ loading: true, configured: true });
  useEffect(() => {
    getData("enrollments")
      .then((r) => setQ({ loading: false, ...r }))
      .catch(() =>
        setQ({
          loading: false,
          error: "Enrolled courses could not be loaded.",
        }),
      );
  }, []);
  const rows = extract(q.data, "enrollments");
  return (
    <QueryState
      loading={q.loading}
      error={q.error}
      configured={q.configured !== false}
    >
      <Heading
        eyebrow="Learn"
        title="Your courses"
        desc="Pick up where you left off or browse published courses."
        action={
          <Link className="btn btn-outline btn-small" href="/courses">
            Explore catalogue <ArrowRight size={15} />
          </Link>
        }
      />
      {rows.length ? (
        <div className="grid-2">
          {rows.map((e: any) => (
            <Link
              className="card"
              href={`/learn/${e.course_id || e.course?.id}`}
              key={e.id}
              style={{ padding: 22 }}
            >
              <div className="course-thumb course-thumb-wide">
                {e.course?.thumbnail_url ? (
                  <img src={e.course.thumbnail_url} alt="" loading="lazy" />
                ) : (
                  <BookOpen size={24} />
                )}
              </div>
              <div className="eyebrow">{text(e.status, "In progress")}</div>
              <h2
                className="font-display"
                style={{ fontSize: 23, margin: "12px 0 4px" }}
              >
                {text(e.course?.title, e.title || "Course")}
              </h2>
              <p className="field-hint">
                {text(e.course?.category, "Learning path")}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  margin: "17px 0 7px",
                }}
              >
                <span>Progress</span>
                <strong>{Number(e.progress_percent || 0)}%</strong>
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: `${Math.max(0, Math.min(100, Number(e.progress_percent || 0)))}%`,
                  }}
                />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="No course enrollments yet."
          body="When you enroll in a published course, it will appear here with your progress and next lesson."
          href="/courses"
          label="Browse courses"
        />
      )}
    </QueryState>
  );
}

function CoursePlayer({ courseId }: { courseId: string }) {
  const [q, setQ] = useState<any>({ loading: true, configured: true });
  const [selected, setSelected] = useState<any>(null);
  const [feedback, setFeedback] = useState("");
  const load = useCallback(
    (preferredId?: string) => {
      setQ((prev: any) => ({ ...prev, loading: true, error: undefined }));
      getData("lessons", { course_id: courseId })
        .then((r) => {
          const data = r.data || {};
          const lessons = asArray(data.lessons);
          const progress = data.progress || {};
          const resumeId =
            preferredId ||
            progress.current_lesson_id ||
            progress.current_lesson?.id ||
            progress.enrollment?.current_lesson_id;
          setQ({
            ...r,
            loading: false,
            data,
            lessons,
            course: data.course || null,
            progress,
          });
          setSelected(
            (prev: any) =>
              lessons.find((l: any) => l.id === resumeId) ||
              lessons.find((l: any) => l.id === prev?.id) ||
              lessons[0] ||
              null,
          );
        })
        .catch(() =>
          setQ({
            loading: false,
            error: "Authorized course content could not be loaded.",
          }),
        );
    },
    [courseId],
  );
  useEffect(() => {
    load();
  }, [load]);
  const lessons = asArray(q.lessons);
  const completedIds = new Set(asArray(q.progress?.completed_lesson_ids));
  const complete = async () => {
    if (!selected) return;
    setFeedback("");
    const r = await postAction("complete_lesson", { lesson_id: selected.id });
    if (!r.ok) {
      setFeedback(r.error);
      return;
    }
    setFeedback(r.message || "Lesson progress updated.");
    load(r.data?.current_lesson_id);
  };
  const resources = asArray(selected?.resources)
    .map((r: any) =>
      typeof r === "string" ? { title: r, url: r, resource_type: "LINK" } : r,
    )
    .filter((r: any) => safeResourceHref(r.url));
  return (
    <QueryState
      loading={q.loading}
      error={q.error}
      configured={q.configured !== false}
    >
      <Link
        href="/learn"
        className="eyebrow"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 18,
        }}
      >
        <ArrowRight size={14} style={{ transform: "rotate(180deg)" }} /> My
        learning
      </Link>
      <Heading
        eyebrow="Course player"
        title={text(q.course?.title, "Your course")}
        desc="Your authorized lessons and saved course progress."
      />
      {!lessons.length ? (
        <Empty
          title="No lessons are available."
          body="This course may still be in progress, or its content may not yet be available to your account."
          href="/learn"
          label="Back to courses"
        />
      ) : (
        <div className="grid-2 course-player-layout">
          <div className="card" style={{ padding: 10, alignSelf: "start" }}>
            {lessons.map((l: any, i: number) => (
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                className="lesson-row"
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: selected?.id === l.id ? "#edf2e8" : "transparent",
                  border: 0,
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <span className="badge badge-quiet">{i + 1}</span>
                <span style={{ fontSize: 13, flex: 1 }}>
                  {text(l.title, "Lesson")}
                </span>
                {(l.completed_at || completedIds.has(l.id)) && (
                  <Check size={15} />
                )}
              </button>
            ))}
          </div>
          <article className="card" style={{ padding: 24 }}>
            {selected ? (
              <>
                <span className="eyebrow">Lesson</span>
                <h2
                  className="font-display"
                  style={{ fontSize: 30, margin: "8px 0 18px" }}
                >
                  {selected.title}
                </h2>
                {selected.video_url && (
                  <LessonVideo
                    key={selected.id}
                    src={selected.video_url}
                    title={selected.title}
                  />
                )}
                {selected.body && (
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 15,
                      lineHeight: 1.75,
                    }}
                  >
                    {selected.body}
                  </div>
                )}
                {selected.exercise && (
                  <div className="soft-panel" style={{ marginTop: 18 }}>
                    <strong>Exercise</strong>
                    <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                      {selected.exercise}
                    </p>
                  </div>
                )}
                {selected.prompt && (
                  <div className="soft-panel" style={{ marginTop: 12 }}>
                    <strong>Prompt</strong>
                    <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                      {selected.prompt}
                    </p>
                  </div>
                )}
                {resources.length > 0 && (
                  <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
                    <strong>Resources</strong>
                    {resources.map((r: any, i: number) => {
                      const href = safeResourceHref(r.url);
                      const kind = String(
                        r.resource_type || "LINK",
                      ).toUpperCase();
                      if (!href) return null;
                      return (
                        <div key={r.id || i}>
                          {kind === "IMAGE" ? (
                            <figure style={{ margin: 0 }}>
                              <img
                                src={href}
                                alt={text(r.title, "Lesson resource image")}
                                loading="lazy"
                                style={{
                                  display: "block",
                                  width: "100%",
                                  height: "auto",
                                  maxHeight: 560,
                                  objectFit: "contain",
                                  borderRadius: 12,
                                }}
                              />
                              {r.title && (
                                <figcaption
                                  className="field-hint"
                                  style={{ marginTop: 5 }}
                                >
                                  {r.title}
                                </figcaption>
                              )}
                            </figure>
                          ) : (
                            <a
                              className="btn btn-outline btn-small"
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              download={kind === "FILE" ? true : undefined}
                            >
                              {kind === "FILE" ? "Download" : "Open"}{" "}
                              {text(
                                r.title,
                                kind === "FILE" ? "lesson file" : "lesson link",
                              )}{" "}
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!selected.body &&
                  !selected.video_url &&
                  !selected.exercise &&
                  !selected.prompt &&
                  resources.length === 0 && (
                    <Notice>
                      This lesson has no published content available yet.
                    </Notice>
                  )}
                <div className="rule" style={{ margin: "22px 0" }} />
                <button
                  className="btn"
                  onClick={complete}
                  disabled={
                    !!(selected.completed_at || completedIds.has(selected.id))
                  }
                >
                  <Check size={16} />
                  {selected.completed_at || completedIds.has(selected.id)
                    ? "Lesson completed"
                    : "Mark lesson complete"}
                </button>
                {feedback && (
                  <div style={{ marginTop: 14 }}>
                    <Notice
                      type={
                        feedback.toLowerCase().includes("could not")
                          ? "error"
                          : "success"
                      }
                    >
                      {feedback}
                    </Notice>
                  </div>
                )}
              </>
            ) : (
              <p>Select a lesson to begin.</p>
            )}
          </article>
        </div>
      )}
    </QueryState>
  );
}

function Reviews() {
  const [q, setQ] = useState<any>({ loading: true, configured: true });
  useEffect(() => {
    Promise.all([getData("reviews"), getData("review_configuration")])
      .then(([r, c]) =>
        setQ({
          loading: false,
          configured: r.configured !== false && c.configured !== false,
          data: r.data || {},
          config: c.data || {},
        }),
      )
      .catch(() =>
        setQ({
          loading: false,
          error: "Review history and scoring settings could not be loaded.",
        }),
      );
  }, []);
  const payload = q.data || {};
  const rows = asArray(payload.reviews);
  const balance = Number(payload.reviewBalance ?? 0);
  const configuredSettings = settingMap(q.config?.settings || []);
  const scoreMax = Number(configuredSettings["review.scoring_max"]);
  const criteria = asArray(q.config?.scoring_criteria);
  return (
    <QueryState
      loading={q.loading}
      error={q.error}
      configured={q.configured !== false}
    >
      <Heading
        eyebrow="Practice & feedback"
        title="Make something. Get perspective."
        desc="Submit work when you’re ready, then return here for status and feedback."
        action={
          <Link className="btn" href="/reviews/new">
            <Plus size={16} /> Submit work
          </Link>
        }
      />
      <div
        className="card"
        style={{
          padding: 22,
          marginBottom: 22,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow">Available review credits</div>
          <div className="stat-value">{balance}</div>
          <p className="field-hint" style={{ marginBottom: 0 }}>
            Credits are shown from your account balance.
          </p>
        </div>
        <Link href="/membership" className="btn btn-outline btn-small">
          See published plans <ArrowRight size={15} />
        </Link>
      </div>
      <ReviewCreditPurchase />
      {rows.length ? (
        <div className="grid-2">
          {rows.map((r: any) => (
            <article className="card" key={r.id} style={{ padding: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span className="badge">
                  {text(r.status, "Awaiting status")}
                </span>
                <span className="field-hint">{formatDate(r.created_at)}</span>
              </div>
              <h2
                className="font-display"
                style={{ fontSize: 21, margin: "15px 0 4px" }}
              >
                {text(r.title, "Project review")}
              </h2>
              <p className="field-hint">
                {text(
                  r.review_category_label || r.review_category,
                  r.project_category_label ||
                    r.project_category ||
                    "Submitted work",
                )}
              </p>
              {r.overall_score != null && (
                <strong>
                  Score: {r.overall_score}
                  {Number.isFinite(scoreMax) && scoreMax > 0
                    ? ` / ${scoreMax}`
                    : " points"}
                </strong>
              )}
              {r.strengths && (
                <div style={{ fontSize: 13, marginTop: 14 }}>
                  <strong>Strengths</strong>
                  <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                    {r.strengths}
                  </p>
                </div>
              )}
              {r.improvements && (
                <div style={{ fontSize: 13 }}>
                  <strong>Ways to improve</strong>
                  <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                    {r.improvements}
                  </p>
                </div>
              )}
              {r.next_steps && (
                <div style={{ fontSize: 13 }}>
                  <strong>Next steps</strong>
                  <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                    {r.next_steps}
                  </p>
                </div>
              )}
              {r.category_scores &&
                Object.keys(r.category_scores).length > 0 && (
                  <div style={{ fontSize: 12, marginTop: 12 }}>
                    <strong>Category scores</strong>
                    {Object.entries(r.category_scores).map(([key, score]) => {
                      const criterion = criteria.find(
                        (c: any) =>
                          c.category === r.review_category &&
                          c.criterion_key === key,
                      );
                      return (
                        <div
                          className="lesson-row"
                          key={key}
                          style={{ padding: "5px 0" }}
                        >
                          <span>{criterion?.label || humanize(key)}</span>
                          <strong style={{ marginLeft: "auto" }}>
                            {String(score)}
                            {criterion?.max_score != null
                              ? ` / ${criterion.max_score}`
                              : ""}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Your first review starts with a project."
          body="Upload a piece of work and ask a specific question. The review queue and any feedback will show here."
          href="/reviews/new"
          label="Submit your work"
        />
      )}
    </QueryState>
  );
}

function settingMap(settings: any[]) {
  return Object.fromEntries(
    asArray(settings).map((s: any) => [s.key, s.value]),
  );
}
function firstSetting(map: Record<string, any>, keys: string[]) {
  for (const key of keys) if (map[key] != null) return map[key];
  return null;
}
function NewReview() {
  const [state, setState] = useState<any>({ loading: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    Promise.all([getData("review_configuration"), getData("reviews")])
      .then(([c, r]) =>
        setState({
          loading: false,
          configured: c.configured !== false && r.configured !== false,
          config: c.data || {},
          reviews: r.data || {},
        }),
      )
      .catch(() =>
        setState({
          loading: false,
          error: "Review categories and account limits could not be loaded.",
        }),
      );
  }, []);
  const config = state.config || {};
  const settings = settingMap(config.settings || []);
  const reviewData = state.reviews || {};
  const balance = Number(reviewData.reviewBalance ?? 0);
  const projects = asArray(config.project_categories);
  const focuses = asArray(config.review_categories);
  const configuredMimes = firstSetting(settings, [
    "review.allowed_mime_types",
    "review.allowed_file_types",
  ]);
  const allowedMimes = asArray(configuredMimes).filter(
    (m: any) => typeof m === "string" && m.toLowerCase().startsWith("video/"),
  );
  const limits = reviewData.limits || {};
  let maxBytes = Number(
    firstSetting(settings, [
      "review.video_max_size_bytes",
      "review.maximum_file_size_bytes",
    ]) ??
      limits.max_video_size_bytes ??
      NaN,
  );
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    const mb = Number(firstSetting(settings, ["review.maximum_file_size_mb"]));
    maxBytes = Number.isFinite(mb) && mb > 0 ? mb * 1024 * 1024 : NaN;
  }
  const maxSeconds = Number(
    firstSetting(settings, [
      "review.video_max_duration_seconds",
      "review.maximum_video_duration_seconds",
    ]) ??
      limits.max_video_duration_seconds ??
      NaN,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setSuccess("");
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose one video to submit.");
      setBusy(false);
      return;
    }
    if (!allowedMimes.includes(file.type)) {
      setError(
        "Choose a video format currently allowed by the review settings.",
      );
      setBusy(false);
      return;
    }
    if (!Number.isFinite(maxBytes) || file.size > maxBytes) {
      setError(
        "This video exceeds the configured file-size limit, or that limit is unavailable.",
      );
      setBusy(false);
      return;
    }
    if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) {
      setError(
        "The configured video duration limit is unavailable. Please try again later.",
      );
      setBusy(false);
      return;
    }
    if (balance < 1) {
      setError("There are no review credits available on your account.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/reviews/upload", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const json = await res.json().catch(() => ({
        ok: false,
        error: "The server response could not be read.",
      }));
      if (!res.ok || json.ok !== true)
        setError(
          json.error || "We couldn’t upload your work. Please try again.",
        );
      else {
        setSuccess(
          json.message ||
            "Your work was received. Check your review history for the verified status.",
        );
        form.reset();
      }
    } catch {
      setError(
        "We couldn’t reach the upload service. Your submission has not been confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (state.loading)
    return <p className="loading">Loading review options and limits…</p>;
  if (state.error) return <Notice type="error">{state.error}</Notice>;
  const ready =
    state.configured &&
    projects.length > 0 &&
    focuses.length > 0 &&
    allowedMimes.length > 0 &&
    Number.isFinite(maxBytes) &&
    Number.isFinite(maxSeconds);
  return (
    <>
      <Link className="eyebrow" href="/reviews">
        ← Back to reviews
      </Link>
      <Heading
        eyebrow="Practice review"
        title="Share what you’re working on."
        desc="Add a short project video and tell a reviewer what kind of feedback would help most."
      />
      {!ready ? (
        <Notice type="error">
          Review settings or category choices are not available, so this form
          cannot safely accept a submission.
        </Notice>
      ) : (
        <form
          className="card"
          style={{ padding: 25, maxWidth: 760, display: "grid", gap: 16 }}
          onSubmit={submit}
          encType="multipart/form-data"
        >
          <div
            className="soft-panel"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              justifyContent: "space-between",
            }}
          >
            <span>
              <strong>{balance}</strong> remaining review credits
            </span>
            <span>Maximum file size: {maxBytes.toLocaleString()} bytes</span>
            <span>Maximum video duration: {maxSeconds} seconds</span>
          </div>
          <div className="field">
            <label htmlFor="title">Project title</label>
            <input
              className="input"
              id="title"
              name="title"
              required
              maxLength={180}
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="project_category">Project area</label>
              <select
                className="select"
                id="project_category"
                name="project_category"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose an area
                </option>
                {projects.map((x: any) => (
                  <option key={x.category} value={x.category}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="review_category">Feedback focus</label>
              <select
                className="select"
                id="review_category"
                name="review_category"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose focus
                </option>
                {focuses.map((x: any) => (
                  <option key={x.category} value={x.category}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">What did you make?</label>
            <textarea
              className="textarea"
              id="description"
              name="description"
              required
              maxLength={5000}
            />
          </div>
          <div className="field">
            <label htmlFor="question">
              What question should your reviewer answer?
            </label>
            <textarea
              className="textarea"
              id="question"
              name="question"
              required
              maxLength={5000}
            />
          </div>
          <div className="field">
            <label htmlFor="file">Project video</label>
            <input
              className="input"
              id="file"
              name="file"
              type="file"
              required
              accept={allowedMimes.join(",")}
            />
            <span className="field-hint">
              Configured video formats: {allowedMimes.join(", ")}. Duration and
              size are verified by the upload service.
            </span>
          </div>
          {error && <Notice type="error">{error}</Notice>}
          {success && (
            <Notice type="success">
              {success}{" "}
              <Link className="link-under" href="/reviews">
                View review history
              </Link>
            </Notice>
          )}
          <button className="btn" disabled={busy || balance < 1}>
            {busy ? (
              "Submitting…"
            ) : (
              <>
                <FileUp size={16} /> Submit for review
              </>
            )}
          </button>
          <p className="field-hint" style={{ margin: 0 }}>
            A review is confirmed only after the upload service accepts it and
            returns success.
          </p>
        </form>
      )}
    </>
  );
}

function Support() {
  const [state, setState] = useState<any>({ loading: true, configured: true });
  const [packageId, setPackageId] = useState("");
  const [slot, setSlot] = useState("");
  const [hold, setHold] = useState<any>(null);
  const [provider, setProvider] = useState("");
  const [message, setMessage] = useState("");
  const [reschedule, setReschedule] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    setState((s: any) => ({ ...s, loading: true }));
    Promise.all([
      getData("support_packages"),
      getData("availability"),
      getData("appointments"),
      getData("payment_readiness"),
      getData("me"),
    ])
      .then(([p, a, b, pr, me]) =>
        setState({
          loading: false,
          configured: [p, a, b, pr, me].every((r) => r.configured !== false),
          packages: asArray(p.data),
          slots: asArray(a.data),
          appointments: asArray(b.data),
          readiness: pr.data || {},
          profile: me.data?.profile || {},
        }),
      )
      .catch(() =>
        setState({
          loading: false,
          error: "Support options could not be loaded.",
        }),
      );
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const packages = asArray(state.packages);
  const slots = asArray(state.slots).filter(
    (s: any) =>
      Number(s.remaining_capacity) > 0 &&
      (!packageId || s.package_id === packageId),
  );
  const appointments = asArray(state.appointments);
  const country = state.profile?.country_code || "";
  async function reserve() {
    setMessage("");
    setHold(null);
    setProvider("");
    const r = await postAction("hold_slot", { availability_id: slot });
    if (!r.ok) {
      setMessage(r.error);
      return;
    }
    setHold(r.data || null);
    setMessage(
      r.message ||
        "Availability is temporarily held. This is not a confirmed appointment.",
    );
  }
  async function checkout() {
    if (
      !hold?.price_id ||
      !provider ||
      !country ||
      !holdProviders.some((p: any) => p.code === provider)
    ) {
      setMessage(
        !country
          ? "Add your country to your profile before starting checkout."
          : "Choose an available payment provider to continue.",
      );
      return;
    }
    const r = await postAction("checkout", {
      price_id: hold.price_id,
      provider,
      country_code: country,
      metadata: { availability_id: slot, hold_id: hold.hold_id || hold.id },
    });
    if (!r.ok) {
      setMessage(r.error);
      return;
    }
    if (r.data?.url) window.location.assign(r.data.url);
    else
      setMessage(
        r.message ||
          "Checkout response received; appointment confirmation is still pending verified payment.",
      );
  }
  async function cancelAppointment(id: string) {
    const r = await postAction("appointment_cancel", { appointment_id: id });
    setMessage(r.ok ? r.message || "Cancellation request confirmed." : r.error);
    if (r.ok) load();
  }
  async function moveAppointment(id: string) {
    const availability_id = reschedule[id];
    if (!availability_id) return;
    const r = await postAction("appointment_reschedule", {
      appointment_id: id,
      availability_id,
    });
    setMessage(r.ok ? r.message || "Reschedule request confirmed." : r.error);
    if (r.ok) {
      setReschedule((v) => ({ ...v, [id]: "" }));
      load();
    }
  }
  const slotPackage = packages.find(
    (p: any) =>
      p.id === packageId ||
      p.id === asArray(state.slots).find((s: any) => s.id === slot)?.package_id,
  );
  const holdCurrency =
    hold?.currency || hold?.price?.currency || slotPackage?.currency;
  const readinessProviders = asArray(state.readiness?.providers);
  const holdProviders = asArray(hold?.providers).filter((p: any) => {
    if (!readinessProviders.length) return true;
    const ready = readinessProviders.find((r: any) => r.code === p.code);
    if (!ready || ready.ready !== true) return false;
    if (
      Array.isArray(ready.countries) &&
      (!country || !ready.countries.includes(country))
    )
      return false;
    if (
      Array.isArray(ready.currencies) &&
      (!holdCurrency || !ready.currencies.includes(holdCurrency))
    )
      return false;
    return true;
  });
  return (
    <QueryState
      loading={state.loading}
      error={state.error}
      configured={state.configured !== false}
    >
      <Heading
        eyebrow="Expert support"
        title="Talk through your next step."
        desc="See the support packages and real availability currently offered by the network."
      />
      <section className="support-profile-card">
        <div className="support-avatar" aria-hidden="true">
          <span>RA</span>
          <i />
        </div>
        <div>
          <span className="eyebrow">Your support guide</span>
          <h2 className="font-display">A practical second pair of eyes.</h2>
          <p className="muted">Bring a prompt, project, or challenge. We’ll help you turn the next question into a clear action.</p>
        </div>
        <span className="support-profile-badge">Expert support</span>
      </section>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <section>
          <h2 className="font-display" style={{ fontSize: 22 }}>
            Published packages
          </h2>
          {packages.length ? (
            packages.map((p: any) => (
              <article
                className="card"
                style={{ padding: 19, marginBottom: 10 }}
                key={p.id}
              >
                <span className="badge">
                  {p.duration_minutes
                    ? `${p.duration_minutes} minutes`
                    : "Support package"}
                </span>
                <h3
                  className="font-display"
                  style={{ fontSize: 20, margin: "12px 0 4px" }}
                >
                  {p.name}
                </h3>
                {p.description && <p className="field-hint">{p.description}</p>}
                {p.price != null && (
                  <strong style={{ display: "block", marginTop: 8 }}>
                    {money(p.price, p.currency, p.minor_units)}
                  </strong>
                )}
              </article>
            ))
          ) : (
            <Empty
              title="No support packages are published yet."
              body="Packages appear when the team has configured them."
            />
          )}
        </section>
        <section className="card" style={{ padding: 22 }}>
          <span className="eyebrow">Check availability</span>
          <h2
            className="font-display"
            style={{ fontSize: 23, margin: "9px 0 16px" }}
          >
            Choose a real open time.
          </h2>
          {slots.length ? (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="field">
                <label htmlFor="pkg">Package</label>
                <select
                  id="pkg"
                  className="select"
                  value={packageId}
                  onChange={(e) => {
                    setPackageId(e.target.value);
                    setSlot("");
                    setHold(null);
                  }}
                >
                  <option value="">Any available package</option>
                  {packages.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="slot">Available time</label>
                <select
                  id="slot"
                  className="select"
                  value={slot}
                  onChange={(e) => {
                    setSlot(e.target.value);
                    setHold(null);
                  }}
                >
                  <option value="">Select a listed time</option>
                  {slots.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {formatDate(s.starts_at)} ·{" "}
                      {new Date(s.starts_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </option>
                  ))}
                </select>
              </div>
              <p className="field-hint" style={{ margin: 0 }}>
                Checkout uses the country saved on your profile
                {country ? ` (${country})` : "; add one to your account first"}.
              </p>
              <button className="btn" onClick={reserve} disabled={!slot}>
                Request a temporary hold <ArrowRight size={15} />
              </button>
              {message && (
                <Notice type={hold ? "success" : "error"}>{message}</Notice>
              )}
              {hold && (
                <div className="soft-panel">
                  <strong>Temporary hold</strong>
                  <p className="field-hint">
                    Expires{" "}
                    {hold.expires_at
                      ? new Date(hold.expires_at).toLocaleString()
                      : "according to the service response"}
                    . A hold is not a confirmed booking.
                  </p>
                  {holdProviders.length && hold.price_id ? (
                    <>
                      <div className="field">
                        <label htmlFor="provider">Ready payment provider</label>
                        <select
                          id="provider"
                          className="select"
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                        >
                          <option value="">Choose a provider</option>
                          {holdProviders.map((p: any) => (
                            <option key={p.code} value={p.code}>
                              {p.name || p.code}
                              {p.mode ? ` · ${p.mode}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="btn btn-light"
                        onClick={checkout}
                        disabled={!provider || !country}
                      >
                        Continue to secure checkout
                      </button>
                    </>
                  ) : (
                    <p className="field-hint">
                      No payment provider is ready for this held slot. The hold
                      is not a booking; check your country and try again later.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Empty
              title="No bookable times are listed right now."
              body="Appointment times are supplied by live availability. We won’t invent a schedule or mark a hold as a booking."
            />
          )}
        </section>
      </div>
      <section style={{ marginTop: 35 }}>
        <h2 className="font-display" style={{ fontSize: 22 }}>
          Your appointments
        </h2>
        {appointments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Appointment</th>
                  <th>When</th>
                  <th>Status</th>
                  <th>Meeting</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      {text(a.package?.name, a.title || "Support session")}
                    </td>
                    <td>{formatDate(a.starts_at)}</td>
                    <td>{text(a.status, "Status unavailable")}</td>
                    <td>
                      {safeResourceHref(a.meeting_url) ? (
                        <a
                          className="link-under"
                          href={safeResourceHref(a.meeting_url)!}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open link <ExternalLink size={13} />
                        </a>
                      ) : (
                        "Shared when confirmed"
                      )}
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: 7, minWidth: 190 }}>
                        {String(a.status).toUpperCase() === "CONFIRMED" && (
                          <>
                            <button
                              className="btn btn-outline btn-small"
                              onClick={() => cancelAppointment(a.id)}
                            >
                              Request cancellation
                            </button>
                            <select
                              className="select"
                              aria-label="Choose new appointment time"
                              value={reschedule[a.id] || ""}
                              onChange={(e) =>
                                setReschedule((v) => ({
                                  ...v,
                                  [a.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Choose new time</option>
                              {asArray(state.slots)
                                .filter(
                                  (s: any) =>
                                    Number(s.remaining_capacity) > 0 &&
                                    s.package_id === a.package_id &&
                                    s.id !== a.availability_id,
                                )
                                .map((s: any) => (
                                  <option key={s.id} value={s.id}>
                                    {formatDate(s.starts_at)} ·{" "}
                                    {new Date(s.starts_at).toLocaleTimeString(
                                      [],
                                      { hour: "numeric", minute: "2-digit" },
                                    )}
                                  </option>
                                ))}
                            </select>
                            <button
                              className="btn btn-outline btn-small"
                              onClick={() => moveAppointment(a.id)}
                              disabled={!reschedule[a.id]}
                            >
                              Request reschedule
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Confirmed appointments appear here.</p>
        )}
        {message && (
          <p className="field-hint" role="status">
            {message}
          </p>
        )}
      </section>
    </QueryState>
  );
}

function Community({ type }: { type: "all" | "drops" | "events" }) {
  const [state, setState] = useState<any>({ loading: true, configured: true });
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoPreviewReady, setVideoPreviewReady] = useState(false);
  const [videoPreviewError, setVideoPreviewError] = useState(false);
  const [videoStage, setVideoStage] = useState<"" | "preparing" | "uploading" | "processing">("");
  const [hasResumeUrl, setHasResumeUrl] = useState(false);
  const uploadController = useRef<AbortController | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(() => {
    setState((current: any) => ({ ...current, error: undefined }));
    getData("community_access")
      .then((accessResult) => {
        const access = accessResult.data || {};
        if (accessResult.error) {
          setState({ loading: false, configured: accessResult.configured !== false, error: accessResult.error, access });
          return null;
        }
        if (access.community_enabled === false || access.reason === "COMMUNITY_DISABLED") {
          setState({ loading: false, configured: true, disabled: true, access });
          return null;
        }
        if (!access.can_access) {
          setState({ loading: false, configured: true, access, events: [], drops: [], announcements: [], feed: { posts: [] } });
          return null;
        }
        const requests = [getData("events"), getData("ai_drops"), getData("announcements")];
        if (type === "all") {
          requests.push(getData("community_feed"));
          requests.push(getData("community_video_drafts"));
        }
        return Promise.all(requests).then((results) => {
          const [events, drops, announcements, feed, drafts] = results;
          setState({
            loading: false,
            configured: results.every((result) => result.configured !== false),
            events: asArray(events.data),
            drops: asArray(drops.data),
            announcements: asArray(announcements.data),
            access,
            feed: feed?.data || { posts: [] },
            drafts: asArray(drafts?.data?.drafts),
          });
        });
      })
      .catch(() => setState({ loading: false, error: "Community resources could not be loaded." }));
  }, [type]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl("");
      setVideoPreviewReady(false);
      setVideoPreviewError(false);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreviewReady(false);
    setVideoPreviewError(false);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);
  const events = asArray(state.events);
  const drops = asArray(state.drops);
  const announcements = asArray(state.announcements);
  const posts = asArray(state.feed?.posts);
  const access = state.access || {};
  const videoDraft =
    selectedVideo ||
    asArray(state.drafts).find((draft: any) =>
      ["UPLOAD_CREATED", "UPLOADED", "PROCESSING", "READY", "FAILED", "REJECTED"].includes(draft.status),
    ) ||
    null;
  useEffect(() => {
    try { setHasResumeUrl(Boolean(videoDraft?.id && window.sessionStorage.getItem(`riches-video-upload:${videoDraft.id}`))); }
    catch { setHasResumeUrl(false); }
  }, [videoDraft?.id, videoDraft?.status, busy]);
  useEffect(() => {
    if (!videoDraft?.id || busy === "video" || busy === "video-finalizing" ||
        !["UPLOAD_CREATED", "UPLOADED", "PROCESSING"].includes(videoDraft.status))
      return;
    let active = true;
    const refresh = async () => {
      const result = await getData("community_video_drafts").catch(() => null);
      if (!active) return;
      if (!result || result.error) {
        setMessage("Video status is temporarily unavailable. Your upload is saved; try Check again shortly.");
        return;
      }
      const drafts = asArray(result.data?.drafts);
      setState((current: any) => ({ ...current, drafts }));
      const updated = drafts.find((draft: any) => draft.id === videoDraft.id);
      if (updated) {
        setSelectedVideo((current: any) => current?.id === updated.id ? updated : current);
        if (updated.status === "READY")
          setMessage("Your video is ready. Add a caption and share it.");
        else if (["FAILED", "REJECTED"].includes(updated.status))
          setMessage(updated.processing_error || "Bunny could not process this video.");
        else if (updated.status_check_unavailable)
          setMessage("Bunny status could not be checked right now. Your draft is safe; we will try again.");
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => { active = false; window.clearInterval(timer); };
  }, [videoDraft?.id, videoDraft?.status, busy]);
  useEffect(() => {
    if (videoDraft?.status !== "READY" || videoFile) return;
    let active = true;
    const timer = window.setInterval(async () => {
      const result = await getData("community_video_drafts").catch(() => null);
      if (!active || !result || result.error) return;
      const updated = asArray(result.data?.drafts).find((draft: any) => draft.id === videoDraft.id);
      if (updated?.preview_url) setSelectedVideo((current: any) => current?.id === updated.id ? updated : current);
    }, 8 * 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [videoDraft?.id, videoDraft?.status, videoFile]);
  if (state.disabled) {
    return <Empty title="This area is currently unavailable." body="Return to your learning overview to continue with courses, practice, and support." href="/dashboard" label="Return to overview" />;
  }
  const shown = type === "events"
    ? events.map((item: any) => ({ ...item, __kind: "event" }))
    : type === "drops"
      ? drops.map((item: any) => ({ ...item, __kind: "drop" }))
      : [...events.map((item: any) => ({ ...item, __kind: "event" })), ...drops.map((item: any) => ({ ...item, __kind: "drop" }))];
  const whatsapp = access.membership_active ? safeResourceHref(access.whatsapp_url) : null;
  const videoStatusLabel = videoDraft?.status === "READY"
    ? "Ready to share"
    : ["FAILED", "REJECTED"].includes(videoDraft?.status)
      ? "Video could not be shared"
      : videoStage === "preparing" ? "Preparing secure upload"
      : videoStage === "uploading" ? `Uploading to Bunny · ${videoProgress}%`
      : videoDraft?.status === "UPLOAD_CREATED" && !videoFile ? "Upload interrupted — resume or retry"
      : Number(videoDraft?.bunny_status) === 0 ? "Queued for Bunny encoding"
      : Number(videoDraft?.bunny_status) === 1 ? "Bunny is preparing your video"
      : Number(videoDraft?.bunny_status) === 6 ? "Bunny is receiving the upload"
      : Number(videoDraft?.bunny_status) === 7 ? "Upload received by Bunny"
      : "Bunny is encoding your video";
  async function uploadVideo(file: File, resumeDraft?: any) {
    const maxBytes = Number(access.limits?.max_video_upload_mb || 250) * 1024 * 1024;
    if (!resumeDraft && !access.can_video_upload) {
      setMessage("Video uploads are not available for this account right now.");
      return;
    }
    if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) {
      setMessage("Choose an MP4, MOV, or WebM video.");
      return;
    }
    if (file.size > maxBytes) {
      setMessage(`Choose a video smaller than ${access.limits?.max_video_upload_mb || 250} MB.`);
      return;
    }
    if (!file.size) { setMessage("Choose a video file that is not empty."); return; }
    const controller = new AbortController();
    uploadController.current = controller;
    setBusy("video");
    setVideoStage("preparing");
    setVideoFile(file);
    setVideoProgress(0);
    setMessage("Preparing a secure resumable video upload…");
    let createdVideoId: string | null = null;
    let transferComplete = false;
    try {
      const response = await fetch("/api/community/videos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, mime_type: file.type, size_bytes: file.size, ...(resumeDraft ? { resume_video_id: resumeDraft.id } : {}) }),
      });
      const session = await response.json();
      if (!response.ok || !session.ok) throw new Error(session.error || "The video upload could not be prepared.");
      const uploadInfo = session.data?.upload;
      const communityVideoId = session.data?.community_video_id;
      if (!uploadInfo || !communityVideoId) throw new Error("The video upload could not be prepared.");
      createdVideoId = communityVideoId;
      if (controller.signal.aborted) throw new Error("Video upload cancelled.");
      setVideoStage("uploading");
      setSelectedVideo({ id: communityVideoId, source_filename: file.name, status: "UPLOAD_CREATED" });
      setMessage("Uploading directly to Bunny. Keep this page open until the transfer reaches 100%.");
      const storageKey = `riches-video-upload:${communityVideoId}`;
      const resumeUrl = resumeDraft ? window.sessionStorage.getItem(storageKey) || undefined : undefined;
      if (resumeDraft && !resumeUrl) throw new Error("This upload location was lost. Remove the draft and start a new upload.");
      const verified = await uploadCommunityVideo(file, uploadInfo, {
        signal: controller.signal,
        onProgress: (bytes, total) => setVideoProgress(Math.round((bytes / total) * 100)),
        resumeUrl,
        onUploadUrl: (url) => { try { window.sessionStorage.setItem(storageKey, url); setHasResumeUrl(true); } catch { /* Upload still works without browser storage. */ } },
      });
      transferComplete = true;
      try { window.sessionStorage.removeItem(storageKey); } catch { /* No persistent client copy to clear. */ }
      setHasResumeUrl(false);
      setVideoStage("processing");
      setBusy("video-finalizing");
      setSelectedVideo({ id: communityVideoId, source_filename: file.name, status: "UPLOADED" });
      if (!verified) {
        setMessage("Bunny accepted every upload chunk, but its final byte check is temporarily unavailable. Your draft is safe; we will check processing automatically.");
        load();
        return;
      }
      setMessage("100% uploaded to Bunny. Video encoding is in progress; you may return later.");
      const finalized = await postAction("community_video_finalize", { video_id: communityVideoId });
      if (!finalized.ok) throw new Error(finalized.error);
      setSelectedVideo(finalized.data);
      setImage(null);
      setMessage(finalized.data?.status === "READY" ? "Your video is ready. Add a caption and share it." : finalized.message || "Upload complete. Bunny is processing your video automatically.");
      load();
    } catch (error) {
      if (transferComplete && createdVideoId) {
        setSelectedVideo({ id: createdVideoId, source_filename: file.name, status: "UPLOADED" });
        setVideoStage("processing");
        setMessage("Upload reached Bunny, but its status check is temporarily unavailable. Your draft is saved; use Check status or return later.");
      } else if (resumeDraft && !createdVideoId) {
        if (error instanceof Error && /can no longer be resumed/.test(error.message)) {
          try { window.sessionStorage.removeItem(`riches-video-upload:${resumeDraft.id}`); } catch { /* Browser storage may be disabled. */ }
          setHasResumeUrl(false);
        }
        setVideoFile(null);
        setSelectedVideo(resumeDraft);
        setVideoProgress(0);
        setVideoStage("");
        setMessage(error instanceof Error ? error.message : "The original upload could not be resumed.");
      } else {
        const resumable = Boolean(createdVideoId && !controller.signal.aborted && (() => {
          try { return window.sessionStorage.getItem(`riches-video-upload:${createdVideoId}`); } catch { return false; }
        })());
        if (resumable) {
          setVideoFile(null);
          setVideoStage("");
          setVideoProgress(0);
          setSelectedVideo({ id: createdVideoId, source_filename: file.name, status: "UPLOAD_CREATED" });
          setHasResumeUrl(true);
          setMessage(`Upload paused: ${error instanceof Error ? error.message : "Network interrupted."} Choose the same file under Resume upload to continue.`);
        } else {
          if (createdVideoId)
            await postAction("community_video_discard", { video_id: createdVideoId }).catch(() => null);
          setVideoFile(null);
          setSelectedVideo(null);
          setVideoProgress(0);
          setVideoStage("");
          setMessage(controller.signal.aborted ? "Upload cancelled. Choose a video to try again." : error instanceof Error ? error.message : "The video could not be uploaded.");
        }
      }
    } finally {
      uploadController.current = null;
      setBusy("");
    }
  }
  async function refreshVideoDraft() {
    if (!videoDraft?.id) return;
    setBusy("video-refresh");
    const result = await getData("community_video_drafts").catch(() => null);
    const updated = asArray(result?.data?.drafts).find((draft: any) => draft.id === videoDraft.id);
    if (result && !result.error) setState((current: any) => ({ ...current, drafts: asArray(result.data?.drafts) }));
    if (updated) setSelectedVideo(updated);
    setMessage(result?.error || (updated?.status === "READY" ? "Your video is ready. Add a caption and share it." :
      updated?.processing_error || (updated?.status_check_unavailable ? "Could not reach Bunny right now. Please try again." :
      "Still encoding on Bunny. You can return later; your draft is saved.")));
    setBusy("");
  }
  async function discardVideoDraft() {
    if (!videoDraft?.id) return;
    setBusy("video-discard");
    const result = await postAction("community_video_discard", { video_id: videoDraft.id });
    setMessage(result.ok ? result.message || "Video upload removed." : result.error);
    if (result.ok) {
      try { window.sessionStorage.removeItem(`riches-video-upload:${videoDraft.id}`); } catch { /* Browser storage may be disabled. */ }
      setHasResumeUrl(false);
      setSelectedVideo(null);
      setVideoFile(null);
      setVideoProgress(0);
      setVideoStage("");
      load();
    }
    setBusy("");
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() && !image && !videoDraft) return;
    if (videoDraft && !body.trim()) {
      setMessage("Add a short caption or context before sharing your video.");
      return;
    }
    if (videoDraft && videoDraft.status !== "READY") {
      setMessage("Wait until Bunny finishes processing this video before sharing it.");
      return;
    }
    setBusy("post");
    setMessage("");
    let imagePath: string | null = null;
    try {
      if (image) {
        const form = new FormData();
        form.append("bucket", "community-media");
        form.append("file", image);
        const upload = await fetch("/api/assets/upload", { method: "POST", body: form }).then((response) => response.json());
        if (!upload.ok) throw new Error(upload.error || "The image could not be uploaded.");
        imagePath = upload.data?.path || null;
      }
      const result = await postAction("community_post_create", {
        body: body.trim() || "Shared an image.",
        image_path: imagePath,
        video_id: videoDraft?.status === "READY" ? videoDraft.id : null,
      });
      if (!result.ok) throw new Error(result.error);
      if (videoDraft?.id) {
        try { window.sessionStorage.removeItem(`riches-video-upload:${videoDraft.id}`); } catch { /* Browser storage may be disabled. */ }
      }
      setHasResumeUrl(false);
      setBody("");
      setImage(null);
      setVideoFile(null);
      setSelectedVideo(null);
      setVideoProgress(0);
      setVideoStage("");
      setMessage(result.message || "Your post is now in the community.");
      load();
    } catch (error) {
      if (imagePath) await postAction("community_media_delete", { path: imagePath });
      setMessage(error instanceof Error ? error.message : "The post could not be shared.");
    } finally {
      setBusy("");
    }
  }
  async function react(postId: string) {
    setBusy(`react:${postId}`);
    const result = await postAction("community_react", { post_id: postId });
    setMessage(result.ok ? result.message || "Reaction updated." : result.error);
    if (result.ok) load();
    setBusy("");
  }
  async function comment(postId: string) {
    const draft = (commentDrafts[postId] || "").trim();
    if (!draft) return;
    setBusy(`comment:${postId}`);
    const result = await postAction("community_comment_create", { post_id: postId, body: draft });
    setMessage(result.ok ? result.message || "Comment added." : result.error);
    if (result.ok) {
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      load();
    }
    setBusy("");
  }
  async function removePost(postId: string) {
    setBusy(`delete:${postId}`);
    const result = await postAction("community_post_delete", { post_id: postId });
    setMessage(result.ok ? result.message || "Post removed." : result.error);
    if (result.ok) load();
    setBusy("");
  }
  async function report(postId: string) {
    setBusy(`report:${postId}`);
    const result = await postAction("community_report", { post_id: postId, reason: "Please review this community post." });
    setMessage(result.ok ? result.message || "Post reported." : result.error);
    setBusy("");
  }
  return (
    <QueryState loading={state.loading} error={state.error} configured={state.configured !== false}>
      <Heading
        eyebrow="Community"
        title={type === "events" ? "Gather, learn, and share." : type === "drops" ? "Useful ideas for your next prompt." : "Share what you’re building."}
        desc={type === "all" ? "A simple member space for useful ideas, questions, and encouragement." : "Published network updates and member-accessible resources are loaded from your account access."}
        action={
          type !== "events" && <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn btn-outline btn-small" href="/community/events">Events</Link>
            <Link className="btn btn-outline btn-small" href="/community/drops">AI drops</Link>
          </div>
        }
      />
      {!access.can_access ? (
        <section className="community-membership-gate card">
          <div className="community-gate-mark"><Shield size={22} /></div>
          <div>
            <span className="eyebrow">Paid member community</span>
            <h2 className="font-display">A more focused space for members.</h2>
            <p className="muted">{access.reason_message || "Activate a paid membership to read posts, share ideas, and join member conversations."}</p>
            <Link href="/membership" className="btn btn-small">View membership options <ArrowRight size={15} /></Link>
          </div>
        </section>
      ) : <>
      {type === "all" && (
        <form className="community-composer" onSubmit={publish}>
          <div className="community-composer-avatar">RA</div>
          <div className="community-composer-main">
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={access.can_post === false ? "Posting is temporarily unavailable for your account." : "Share a question, progress update, or useful idea…"} maxLength={Number(access.limits?.max_post_length || 2000)} disabled={access.can_post === false} aria-label="Write a community post" />
            {(videoFile || videoDraft) && (
              <div className="community-video-preview-card" aria-live="polite">
                <div className="community-video-preview">
                  {videoPreviewUrl ? (
                    <>
                      {!videoPreviewReady && <div className="community-video-preview-placeholder"><Clapperboard size={24} /><strong>{videoPreviewError ? "Preview unavailable on this device" : "Preparing your video preview…"}</strong><span>{videoPreviewError ? "This file format may not play here. Your upload continues and Bunny will prepare a playable version." : "The upload continues independently."}</span></div>}
                      <video src={videoPreviewUrl} autoPlay muted loop playsInline preload="auto"
                        onLoadedData={() => setVideoPreviewReady(true)}
                        onCanPlay={() => setVideoPreviewReady(true)}
                        onError={() => { setVideoPreviewReady(false); setVideoPreviewError(true); }}
                        className={videoPreviewReady ? "is-visible" : ""}
                        aria-label="Silent preview of your selected community video" />
                    </>
                  ) : videoDraft?.status === "READY" && videoDraft.preview_url ? (
                    <iframe src={`${videoDraft.preview_url}&autoplay=true&muted=true`}
                      title="Preview of your ready community video" allow="autoplay; fullscreen; picture-in-picture" />
                  ) : (
                    <div className="community-video-preview-placeholder"><Clapperboard size={24} /><strong>Your video draft is saved</strong><span>The original file preview is available while this device has the file selected. Bunny status is checked automatically.</span></div>
                  )}
                </div>
                <div className="community-video-status-row"><span className="community-video-status-dot" data-status={videoDraft?.status || "UPLOADING"} /><strong>{videoStatusLabel}</strong></div>
                {videoStage === "uploading" && <progress className="community-upload-progress" value={videoProgress} max={100} aria-label="Video bytes uploaded to Bunny" />}
                <p className="community-video-status-detail">
                  {videoStage === "uploading" ? "Keep this page open until upload reaches 100%." :
                    videoDraft?.status === "READY" ? "Encoded and ready. Add a caption, then share your post." :
                    ["FAILED", "REJECTED"].includes(videoDraft?.status) ? videoDraft.processing_error :
                    videoDraft?.status === "UPLOAD_CREATED" && !videoFile ? hasResumeUrl ?
                      "Choose the same file under Resume upload. Bunny will continue from its confirmed byte offset." :
                      "This upload location is no longer available on this device. Remove the draft and choose your file again." :
                    "Your draft is saved. We check Bunny automatically; you can return later while it finishes."}
                </p>
              </div>
            )}
            <div className="community-composer-actions">
              <label className="community-image-picker" aria-disabled={Boolean(videoDraft || videoFile)}>
                <ImagePlus size={16} /> Add image
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={Boolean(videoDraft || videoFile)} onChange={(event) => { setImage(event.target.files?.[0] || null); setSelectedVideo(null); setVideoFile(null); }} />
              </label>
              <label className="community-image-picker" aria-disabled={Boolean(image || videoFile || videoDraft) || busy === "video" || !access.can_video_upload}>
                <Clapperboard size={16} /> Add short video
                <input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={Boolean(image || videoFile || videoDraft) || busy === "video" || !access.can_video_upload} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) uploadVideo(file); }} />
              </label>
              {videoDraft?.status === "UPLOAD_CREATED" && !videoFile && hasResumeUrl && (
                <label className="community-image-picker community-video-resume" aria-disabled={busy === "video"}>
                  <Clapperboard size={16} /> Resume upload
                  <input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={busy === "video"} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) uploadVideo(file, videoDraft); }} />
                </label>
              )}
              {image && <span className="community-file-chip">{image.name}<button type="button" aria-label="Remove selected image" onClick={() => setImage(null)}><X size={13} /></button></span>}
              {(videoFile || videoDraft) && <span className="community-video-chip">
                <Clapperboard size={14} />
                <span className="community-video-filename" title={videoDraft?.source_filename || videoFile?.name}>{text(videoDraft?.source_filename || videoFile?.name, "Community video")}</span>
                <span className="community-video-chip-status">{videoStatusLabel}</span>
                {busy === "video" ? <button type="button" className="link-button" onClick={() => uploadController.current?.abort()}>Cancel upload</button> :
                  busy === "video-finalizing" ? <span className="community-video-chip-status">Verifying upload…</span> : <>
                    {videoDraft && !["READY", "FAILED", "REJECTED"].includes(videoDraft.status) && <button type="button" className="link-button" onClick={refreshVideoDraft} disabled={busy === "video-refresh"}>{busy === "video-refresh" ? "Checking…" : "Check status"}</button>}
                    {videoDraft && <button type="button" aria-label="Remove selected video" onClick={discardVideoDraft} disabled={busy === "video-discard"}><X size={13} /></button>}
                  </>}
              </span>}
              <span className="community-video-limit">Video: {access.limits?.max_video_upload_mb || 250} MB · {access.limits?.max_video_duration_seconds || 180}s · {access.limits?.video_posts_per_day || 1}/day</span>
              <button className="btn btn-small" disabled={busy === "post" || access.can_post === false || (!body.trim() && !image && !videoDraft) || Boolean(videoDraft && videoDraft.status !== "READY")}>{busy === "post" ? "Sharing…" : "Share post"}<Send size={14} /></button>
            </div>
          </div>
        </form>
      )}
      {message && <p className="field-hint" role="status">{message}</p>}
      {whatsapp && type === "all" && <div className="soft-panel community-whatsapp"><strong>Member community</strong><p className="muted" style={{ fontSize: 13 }}>Access is verified for your account.</p><a className="btn btn-outline btn-small" href={whatsapp} target="_blank" rel="noreferrer">Join the WhatsApp community <ExternalLink size={14} /></a></div>}
      {announcements.length > 0 && type === "all" && (
        <section style={{ marginBottom: 25 }}>
          {announcements.map((a: any) => {
            const href = safeResourceHref(a.url || a.href || a.link_url);
            return <div className="soft-panel" style={{ marginBottom: 8 }} key={a.id}><span className="eyebrow">Network update</span><h2 className="font-display" style={{ fontSize: 20, margin: "6px 0" }}>{text(a.title, "Network update")}</h2><p className="muted" style={{ margin: 0 }}>{text(a.description, "")}</p>{href && <a className="link-under" href={href} target="_blank" rel="noreferrer">Read update <ExternalLink size={13} /></a>}</div>;
          })}
        </section>
      )}
      {type === "all" && <section className="community-feed"><div className="community-section-heading"><div><span className="eyebrow">Member feed</span><h2 className="font-display">A little momentum from the network.</h2></div><span className="field-hint">Text, images & video</span></div>{posts.length ? posts.map((post: any) => <article className="community-post card" key={post.id}><div className="community-post-header"><div className="community-author-avatar">{post.author?.avatar_url ? <img src={post.author.avatar_url} alt="" /> : text(post.author?.name, "M").slice(0, 1).toUpperCase()}</div><div className="community-author-copy"><strong>{text(post.author?.name, "Member")}</strong><span>{formatDate(post.created_at)}</span></div><div className="community-post-menu"><button type="button" className="icon-button icon-button-small" aria-label="Report post" onClick={() => report(post.id)} disabled={busy === `report:${post.id}`}><Flag size={14} /></button>{post.is_author && <button type="button" className="icon-button icon-button-small" aria-label="Remove post" onClick={() => removePost(post.id)} disabled={busy === `delete:${post.id}`}><Trash2 size={14} /></button>}</div></div><p className="community-post-body">{post.body}</p>{post.image_url && <img className="community-post-image" src={post.image_url} alt="Shared by a community member" loading="lazy" />}{post.video?.url && <div className="community-post-video"><iframe src={post.video.url} title="Shared community video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>}<div className="community-post-actions"><button type="button" className={post.reacted ? "community-action is-active" : "community-action"} onClick={() => react(post.id)} disabled={busy === `react:${post.id}`}><Heart size={16} fill={post.reacted ? "currentColor" : "none"} /> {post.reaction_count || 0}</button><span className="community-comment-count">{post.comments?.length || 0} comments</span></div><div className="community-comments">{asArray(post.comments).map((comment: any) => <div className="community-comment" key={comment.id}><div className="community-comment-avatar">{text(comment.author?.name, "M").slice(0, 1).toUpperCase()}</div><div><strong>{text(comment.author?.name, "Member")}</strong><p>{comment.body}</p></div></div>)}<div className="community-comment-form"><input value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder={access.can_comment === false ? "Comments are temporarily unavailable." : "Write a thoughtful comment…"} maxLength={Number(access.limits?.max_comment_length || 1000)} disabled={access.can_comment === false} aria-label={`Comment on ${post.author?.name || "member"}'s post`} /><button type="button" className="btn btn-small" onClick={() => comment(post.id)} disabled={busy === `comment:${post.id}` || access.can_comment === false || !(commentDrafts[post.id] || "").trim()}>{busy === `comment:${post.id}` ? "Adding…" : "Comment"}</button></div></div></article>) : <Empty title="The feed is ready for your first post." body="Share a question, a small win, or an idea that could help another learner." />}</section>}
      {shown.length ? <div className="grid-2">{shown.map((item: any) => { const isEvent = item.__kind === "event"; const meetingHref = isEvent ? safeResourceHref(item.meeting_url) : null; const recordingHref = isEvent ? safeResourceHref(item.recording_url) : null; const dropHref = !isEvent ? safeResourceHref(item.resource_url || item.url) : null; const resources = asArray(item.resources).map((r: any) => typeof r === "string" ? { url: r, title: r } : r).map((r: any) => ({ ...r, href: safeResourceHref(r.url) })).filter((r: any) => r.href); return <article className="card" key={`${item.__kind}-${item.id}`} style={{ padding: 22 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span className="badge">{text(item.type, isEvent ? "Event" : "AI drop")}</span>{item.starts_at && <span className="field-hint">{formatDate(item.starts_at)}</span>}</div><h2 className="font-display" style={{ fontSize: 22, margin: "15px 0 6px" }}>{text(item.title, isEvent ? "Community event" : "AI drop")}</h2><p className="muted" style={{ fontSize: 13 }}>{text(item.description, "")}</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{meetingHref && <a className="btn btn-outline btn-small" href={meetingHref} target="_blank" rel="noreferrer">Join event <ExternalLink size={14} /></a>}{recordingHref && <a className="btn btn-outline btn-small" href={recordingHref} target="_blank" rel="noreferrer">Watch recording <ExternalLink size={14} /></a>}{dropHref && <a className="btn btn-outline btn-small" href={dropHref} target="_blank" rel="noreferrer">Open resource <ExternalLink size={14} /></a>}{resources.map((r: any, i: number) => <a className="btn btn-outline btn-small" href={r.href} target="_blank" rel="noreferrer" key={r.id || i}>{text(r.title, "Open resource")} <ExternalLink size={14} /></a>)}</div></article>; })}</div> : type !== "all" && <Empty title={type === "events" ? "No events are published yet." : "No AI drops have been shared yet."} body="Only current, published items available to your account appear here. Check back when new updates are shared." />}
      </>}
    </QueryState>
  );
}
function Account() {
  const [state, setState] = useState<any>({ loading: true, configured: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    Promise.all([getData("me"), getData("countries"), getData("subscriptions")])
      .then(([m, c, s]) =>
        setState({
          loading: false,
          configured: [m, c, s].every((r) => r.configured !== false),
          me: m.data,
          countries: asArray(c.data),
          subscriptions: asArray(s.data),
        }),
      )
      .catch(() =>
        setState({
          loading: false,
          error: "Account information could not be loaded.",
        }),
      );
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    const r = await postAction("profile", {
      name: f.get("name"),
      country_code: f.get("country_code"),
    });
    setSaving(false);
    setMessage(r.ok ? r.message || "Profile update confirmed." : r.error);
  }
  async function cancelMembership(subscription: any) {
    if (
      !window.confirm(
        "Request membership cancellation? The service will confirm the resulting status.",
      )
    )
      return;
    const r = await postAction("cancel_membership", {
      subscription_id: subscription.id,
    });
    setMessage(r.ok ? r.message || "Cancellation request sent." : r.error);
    if (!r.ok) return;
    setState((current: any) => ({
      ...current,
      subscriptions: asArray(current.subscriptions).map((item: any) =>
        item.id === subscription.id
          ? {
              ...item,
              cancellation_requested: true,
              ...(r.data?.status ? { status: r.data.status } : {}),
            }
          : item,
      ),
    }));
    const refreshed = await getData("subscriptions").catch(() => null);
    if (refreshed && !refreshed.error)
      setState((current: any) => ({
        ...current,
        subscriptions: asArray(refreshed.data).map((item: any) =>
          item.id === subscription.id &&
          current.subscriptions.find((old: any) => old.id === item.id)
            ?.cancellation_requested
            ? { ...item, cancellation_requested: true }
            : item,
        ),
      }));
  }
  const profile = state.me?.profile || {};
  const subscriptions = asArray(state.subscriptions);
  return (
    <QueryState
      loading={state.loading}
      error={state.error}
      configured={state.configured !== false}
    >
      <Heading
        eyebrow="Your account"
        title="Profile and preferences."
        desc="Manage details that help personalize your experience."
      />
      <div className="grid-2" style={{ alignItems: "start" }}>
        <form
          className="card"
          style={{ padding: 23, display: "grid", gap: 16 }}
          onSubmit={save}
        >
          <h2 className="font-display" style={{ fontSize: 21, margin: 0 }}>
            Personal details
          </h2>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              className="input"
              id="email"
              value={text(state.me?.user?.email, "Not available")}
              disabled
            />
          </div>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              className="input"
              id="name"
              name="name"
              defaultValue={profile.name || ""}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="country">Country</label>
            <select
              className="select"
              id="country"
              name="country_code"
              defaultValue={profile.country_code || ""}
              required
            >
              <option value="">Choose country</option>
              {asArray(state.countries).map((c: any) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {message && (
            <Notice
              type={
                message.toLowerCase().includes("could not")
                  ? "error"
                  : "success"
              }
            >
              {message}
            </Notice>
          )}
          <button className="btn" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
        <section className="card" style={{ padding: 23 }}>
          <span className="eyebrow">Membership</span>
          <h2
            className="font-display"
            style={{ fontSize: 22, margin: "9px 0" }}
          >
            Your membership
          </h2>
          <p className="field-hint">
            Membership periods are manually renewed; they do not renew
            automatically.
          </p>
          {subscriptions.length ? (
            subscriptions.map((s: any) => {
              const planName = text(
                s.plan_name || s.plan_snapshot?.plan_name || s.plan?.name,
                "Membership",
              );
              const benefits = asArray(
                s.benefits || s.plan_snapshot?.benefits || s.plan?.benefits,
              );
              const status = String(
                s.status || "Status unavailable",
              ).toUpperCase();
              return (
                <article
                  key={s.id}
                  className="soft-panel"
                  style={{ marginTop: 12, padding: 17 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>{planName}</strong>
                    <span className="badge">
                      {text(s.status, "Status unavailable")}
                    </span>
                  </div>
                  {s.period_end && (
                    <p className="field-hint" style={{ margin: "8px 0" }}>
                      Paid through {formatDate(s.period_end)}
                    </p>
                  )}
                  {benefits.length > 0 && (
                    <ul className="field-hint" style={{ paddingLeft: 19 }}>
                      {benefits.map((benefit: any, i: number) => (
                        <li key={i}>
                          {typeof benefit === "string"
                            ? benefit
                            : text(benefit?.name || benefit?.title, "")}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(status === "ACTIVE" || status === "EXPIRING") && (
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => cancelMembership(s)}
                      disabled={s.cancellation_requested}
                    >
                      {s.cancellation_requested
                        ? "Cancellation requested"
                        : "Request cancellation"}
                    </button>
                  )}
                </article>
              );
            })
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13 }}>
                No membership is shown on this account.
              </p>
              <Link
                href="/membership"
                className="link-under"
                style={{ fontWeight: 700, fontSize: 13 }}
              >
                View published options
              </Link>
            </>
          )}
        </section>
      </div>
    </QueryState>
  );
}

function Purchases() {
  const [state, setState] = useState<any>({ loading: true, configured: true });
  useEffect(() => {
    Promise.all([getData("orders"), getData("subscriptions")])
      .then(([o, s]) =>
        setState({
          loading: false,
          configured: o.configured !== false && s.configured !== false,
          orders: asArray(o.data),
          subscriptions: asArray(s.data),
        }),
      )
      .catch(() =>
        setState({
          loading: false,
          error: "Purchase history could not be loaded.",
        }),
      );
  }, []);
  const orders = asArray(state.orders);
  const subscriptions = asArray(state.subscriptions);
  return (
    <QueryState
      loading={state.loading}
      error={state.error}
      configured={state.configured !== false}
    >
      <Heading
        eyebrow="Account"
        title="Purchases & billing"
        desc="Check transactions and subscriptions recorded for your account."
      />
      <h2 className="font-display" style={{ fontSize: 22 }}>
        Orders
      </h2>
      {orders.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id}>
                  <td>
                    {text(
                      o.product?.name,
                      o.reference || `Order ${String(o.id).slice(0, 8)}`,
                    )}
                  </td>
                  <td>{formatDate(o.created_at)}</td>
                  <td>
                    {text(o.amount, "—")} {text(o.currency, "")}
                  </td>
                  <td>
                    <span className="badge">
                      {text(o.status, "Unconfirmed")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="No purchases recorded."
          body="A payment only appears here after the payment provider has verified it."
        />
      )}
      <h2 className="font-display" style={{ fontSize: 22, marginTop: 30 }}>
        Subscriptions
      </h2>
      {subscriptions.length ? (
        subscriptions.map((s: any) => (
          <article
            className="card"
            key={s.id}
            style={{
              padding: 19,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              gap: 15,
            }}
          >
            <div>
              <strong>{text(s.plan?.name, s.plan_name || "Membership")}</strong>
              <p className="field-hint">
                {text(s.status, "Status unavailable")} ·{" "}
                {s.period_end
                  ? `period ends ${formatDate(s.period_end)}`
                  : "Billing dates not available"}
              </p>
            </div>
            <span className="badge">{text(s.provider, "Provider")}</span>
          </article>
        ))
      ) : (
        <p className="muted">No subscriptions recorded.</p>
      )}
    </QueryState>
  );
}

function Notifications() {
  const [state, setState] = useState<any>({ loading: true, configured: true });
  const [message, setMessage] = useState("");
  const load = useCallback(
    () =>
      getData("notifications")
        .then((r) => setState({ loading: false, ...r }))
        .catch(() =>
          setState({
            loading: false,
            error: "Notifications could not be loaded.",
          }),
        ),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const rows = extract(state.data, "notifications");
  async function mark(id: string) {
    const r = await postAction("notification_read", { id });
    setMessage(r.ok ? r.message || "Notification marked read." : r.error);
    if (r.ok) load();
  }
  return (
    <QueryState
      loading={state.loading}
      error={state.error}
      configured={state.configured !== false}
    >
      <Heading
        eyebrow="Updates"
        title="Notifications"
        desc="Network updates and account activity confirmed for your account."
      />
      {message && <Notice type="success">{message}</Notice>}
      {rows.length ? (
        <div className="card" style={{ padding: "5px 20px" }}>
          {rows.map((n: any) => (
            <div className="lesson-row" key={n.id}>
              <span className="badge badge-yellow">
                <Bell size={14} />
              </span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 14 }}>
                  {text(n.title, "Update")}
                </strong>
                <p className="field-hint" style={{ margin: "3px 0" }}>
                  {text(n.body, n.message || "")}
                </p>
                <span className="field-hint">{formatDate(n.created_at)}</span>
              </div>
              {!n.read_at && (
                <button
                  className="btn btn-outline btn-small"
                  onClick={() => mark(n.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="You’re all caught up."
          body="Confirmed account updates will appear here. Email delivery is shown only when it has actually been configured."
        />
      )}
    </QueryState>
  );
}
