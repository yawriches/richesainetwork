"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  PlayCircle,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { PurchasePanel } from "@/components/purchase-panel";
import {
  asArray,
  getData,
  humanize,
  money,
  postAction,
  safeResourceHref,
  text,
} from "@/lib/ui";

type Course = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
  instructor?: any;
  category?: string;
  level?: string;
  access_type: string;
  featured?: boolean;
  estimated_minutes?: number;
  objectives?: any;
  prerequisites?: any;
  product_id?: string;
  lesson_count: number;
  owned: boolean;
  included: boolean;
  price: { id: string; amount: number; currency: string; minor_units?: number } | null;
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "FREE", label: "Free" },
  { key: "PURCHASE", label: "Paid" },
  { key: "MEMBERSHIP", label: "Members" },
] as const;

function instructorName(course: Course) {
  return typeof course.instructor === "string"
    ? course.instructor
    : text(course.instructor?.name, "");
}
function duration(minutes?: number) {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function listOf(value: any): string[] {
  if (Array.isArray(value)) return value.map(String).filter((v) => v.trim());
  if (typeof value === "string")
    return value
      .split(/\n+/)
      .map((v) => v.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
  return [];
}
function priceLabel(course: Course) {
  if (course.access_type === "FREE") return "Free";
  if (course.access_type === "MEMBERSHIP") return course.included ? "Included" : "Members";
  if (course.price)
    return money(course.price.amount, course.price.currency, course.price.minor_units);
  return "Unavailable";
}

function useMarketplace() {
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    courses: Course[];
    country?: string | null;
  }>({ loading: true, courses: [] });
  useEffect(() => {
    let active = true;
    getData("marketplace")
      .then((r: any) => {
        if (!active) return;
        if (r.error) setState({ loading: false, error: r.error, courses: [] });
        else
          setState({
            loading: false,
            courses: asArray(r.data?.courses),
            country: r.data?.country_code,
          });
      })
      .catch(() =>
        active &&
        setState({
          loading: false,
          error: "The marketplace could not be loaded. Please refresh.",
          courses: [],
        }),
      );
    return () => {
      active = false;
    };
  }, []);
  return state;
}

function Thumb({ course, large = false }: { course: Course; large?: boolean }) {
  const src = safeResourceHref(course.thumbnail_url);
  return (
    <div className={large ? "market-thumb market-thumb-large" : "market-thumb"}>
      {src ? (
        <img src={src} alt="" loading="lazy" />
      ) : (
        <div className="market-thumb-fallback" aria-hidden="true">
          <BookOpen size={large ? 34 : 24} />
          <span>{text(course.category, "Course")}</span>
        </div>
      )}
      {course.owned && (
        <span className="market-thumb-badge is-owned">
          <Check size={12} /> Enrolled
        </span>
      )}
      {!course.owned && course.featured && (
        <span className="market-thumb-badge">
          <Sparkles size={12} /> Featured
        </span>
      )}
    </div>
  );
}

export function Marketplace() {
  const params = useSearchParams();
  const router = useRouter();
  const { loading, error, courses } = useMarketplace();
  const [search, setSearch] = useState(params.get("search") || "");
  const [filter, setFilter] = useState<string>("ALL");
  const [category, setCategory] = useState("");

  useEffect(() => {
    setSearch(params.get("search") || "");
  }, [params]);

  const categories = useMemo(
    () =>
      Array.from(new Set(courses.map((c) => text(c.category, "")).filter(Boolean))).sort(),
    [courses],
  );
  const visible = courses.filter((c) => {
    const q = search.trim().toLowerCase();
    if (filter !== "ALL" && c.access_type !== filter) return false;
    if (category && c.category !== category) return false;
    if (!q) return true;
    return [c.title, c.description, c.category, instructorName(c)]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <div className="market">
      <div className="market-head">
        <div>
          <span className="eyebrow">Marketplace</span>
          <h1 className="display market-title">Find your next skill.</h1>
          <p className="muted market-sub">
            Practical AI courses you can start today. Free courses open instantly;
            paid courses unlock as soon as your payment is confirmed.
          </p>
        </div>
      </div>

      <div className="market-toolbar">
        <form
          className="market-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const value = search.trim();
            router.replace(value ? `/marketplace?search=${encodeURIComponent(value)}` : "/marketplace");
          }}
        >
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search courses"
            aria-label="Search the marketplace"
          />
        </form>
        <div className="market-chips" role="group" aria-label="Filter by access">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="market-chip"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
          {categories.length > 1 && (
            <select
              className="market-chip market-select"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="market-grid" aria-busy="true" aria-label="Loading courses">
          {[0, 1, 2, 3].map((i) => (
            <div className="market-card market-skeleton" key={i}>
              <div className="market-thumb" />
              <div className="market-card-body">
                <span />
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : !courses.length ? (
        <div className="soft-panel">
          <strong>New courses are on the way.</strong>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
            Nothing is published in the marketplace yet. Check back soon.
          </p>
        </div>
      ) : !visible.length ? (
        <div className="soft-panel">
          <strong>No courses match that search.</strong>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
            Try a different word or clear your filters.
          </p>
          <button
            type="button"
            className="link-under"
            style={{ marginTop: 10, background: "none", border: 0, padding: 0, fontWeight: 700 }}
            onClick={() => {
              setSearch("");
              setFilter("ALL");
              setCategory("");
              router.replace("/marketplace");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <p className="field-hint market-count">
            {visible.length} {visible.length === 1 ? "course" : "courses"}
          </p>
          <div className="market-grid">
            {visible.map((course) => {
              const name = instructorName(course);
              const meta = [
                course.level ? humanize(course.level.toLowerCase()) : "",
                course.lesson_count ? `${course.lesson_count} ${course.lesson_count === 1 ? "lesson" : "lessons"}` : "",
                duration(course.estimated_minutes),
              ].filter(Boolean);
              const label = priceLabel(course);
              return (
                <Link
                  key={course.id}
                  href={`/marketplace/${course.slug}`}
                  className="market-card"
                >
                  <Thumb course={course} />
                  <div className="market-card-body">
                    <h2 className="market-card-title">{course.title}</h2>
                    {name && <p className="market-card-by">{name}</p>}
                    {meta.length > 0 && (
                      <p className="market-card-meta">{meta.join(" · ")}</p>
                    )}
                    <div className="market-card-foot">
                      {course.owned ? (
                        <span className="market-price is-owned">Continue learning</span>
                      ) : (
                        <span
                          className={
                            course.access_type === "FREE" || course.included
                              ? "market-price is-free"
                              : "market-price"
                          }
                        >
                          {label}
                        </span>
                      )}
                      <ArrowRight size={15} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function MarketplaceCourse({ slug }: { slug: string }) {
  const router = useRouter();
  const { loading, error, courses } = useMarketplace();
  const course = courses.find((c) => c.slug === slug);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!course?.id) return;
    getData("curriculum", { course_id: course.id })
      .then((r) => setCurriculum(asArray(r.data)))
      .catch(() => setCurriculum([]));
  }, [course?.id]);

  if (loading) return <p className="loading">Loading course…</p>;
  if (error)
    return (
      <div className="form-alert" role="alert">
        {error}
      </div>
    );
  if (!course)
    return (
      <div className="soft-panel">
        <strong>This course isn’t available.</strong>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
          It may have been unpublished or the link is incorrect.
        </p>
        <Link className="link-under" href="/marketplace" style={{ marginTop: 12, display: "inline-flex", gap: 6, fontWeight: 700 }}>
          Back to marketplace <ArrowRight size={15} />
        </Link>
      </div>
    );

  const name = instructorName(course);
  const objectives = listOf(course.objectives);
  const prerequisites = listOf(course.prerequisites);
  const modules = curriculum.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.module_title || "Course content";
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  async function enrollFree() {
    if (!course) return;
    setBusy(true);
    setMessage("");
    const result = await postAction("enroll", { course_id: course.id });
    if (!result.ok) {
      setBusy(false);
      setMessage(result.error);
      return;
    }
    router.push(`/learn/${course.id}`);
  }

  let action: React.ReactNode;
  if (course.owned || course.included)
    action = (
      <Link className="btn market-buy-btn" href={`/learn/${course.id}`}>
        <PlayCircle size={16} /> {course.owned ? "Continue learning" : "Start learning"}
      </Link>
    );
  else if (course.access_type === "FREE")
    action = (
      <button type="button" className="btn market-buy-btn" onClick={enrollFree} disabled={busy}>
        {busy ? "Enrolling…" : "Enroll for free"} <ArrowRight size={15} />
      </button>
    );
  else if (course.access_type === "MEMBERSHIP")
    action = (
      <>
        <p className="field-hint" style={{ margin: 0 }}>
          This course is included with an active membership.
        </p>
        <Link className="btn market-buy-btn" href="/membership">
          <UsersRound size={16} /> View membership
        </Link>
      </>
    );
  else if (course.access_type === "PURCHASE" && course.product_id && course.price)
    action = (
      <PurchasePanel
        productId={course.product_id}
        priceId={course.price.id}
        label="Buy now"
      />
    );
  else
    action = (
      <p className="field-hint" style={{ margin: 0 }}>
        This course can’t be bought in your country yet. Check your country in
        your account, or contact support.
      </p>
    );

  const facts = [
    course.level && { icon: <Sparkles size={15} />, label: humanize(course.level.toLowerCase()) },
    course.lesson_count > 0 && { icon: <BookOpen size={15} />, label: `${course.lesson_count} ${course.lesson_count === 1 ? "lesson" : "lessons"}` },
    course.estimated_minutes && { icon: <Clock3 size={15} />, label: duration(course.estimated_minutes) },
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  return (
    <div className="market">
      <Link href="/marketplace" className="eyebrow market-back">
        <ArrowLeft size={14} /> Marketplace
      </Link>
      <div className="market-detail">
        <div className="market-detail-main">
          <span className="badge">{text(course.category, "Course")}</span>
          <h1 className="display market-detail-title">{course.title}</h1>
          {course.description && <p className="muted market-detail-desc">{course.description}</p>}
          {name && (
            <p className="market-card-by" style={{ fontSize: 14 }}>
              Created by <strong>{name}</strong>
            </p>
          )}
          {facts.length > 0 && (
            <div className="market-facts">
              {facts.map((f) => (
                <span className="pill" key={f.label}>
                  {f.icon}
                  {f.label}
                </span>
              ))}
            </div>
          )}

          <aside className="market-buy card" aria-label="Get this course">
            <Thumb course={course} large />
            <div className="market-buy-body">
              {!course.owned && !(course.access_type === "PURCHASE" && course.price) && (
                <strong className="market-buy-price">{priceLabel(course)}</strong>
              )}
              {action}
              {message && (
                <div className="form-alert" role="alert">
                  {message}
                </div>
              )}
              {!course.owned && course.access_type === "PURCHASE" && (
                <ul className="market-buy-points">
                  <li><CheckCircle2 size={14} /> Lifetime access to this course</li>
                  <li><CheckCircle2 size={14} /> Pay securely with mobile money</li>
                  <li><CheckCircle2 size={14} /> Access unlocks after payment is confirmed</li>
                </ul>
              )}
            </div>
          </aside>

          {objectives.length > 0 && (
            <section className="card market-section">
              <h2 className="font-display">What you’ll learn</h2>
              <ul className="market-learn">
                {objectives.map((o) => (
                  <li key={o}>
                    <Check size={15} /> {o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {Object.keys(modules).length > 0 && (
            <section className="market-section">
              <h2 className="font-display">Course content</h2>
              <div className="card market-curriculum">
                {Object.entries(modules).map(([title, items]) => (
                  <details key={title} open={Object.keys(modules).length === 1}>
                    <summary>
                      <strong>{title}</strong>
                      <span className="field-hint">{items.length} {items.length === 1 ? "lesson" : "lessons"}</span>
                    </summary>
                    <ol>
                      {items.map((lesson: any) => (
                        <li key={lesson.lesson_id}>
                          <PlayCircle size={14} /> {text(lesson.lesson_title, "Lesson")}
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </section>
          )}

          {prerequisites.length > 0 && (
            <section className="market-section">
              <h2 className="font-display">Requirements</h2>
              <ul className="market-reqs">
                {prerequisites.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
