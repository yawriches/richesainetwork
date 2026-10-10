"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock3,
  LockKeyhole,
  Play,
} from "lucide-react";
import { PurchasePanel } from "@/components/purchase-panel";
import {
  getData,
  humanize,
  postAction,
  safeResourceHref,
  text,
} from "@/lib/ui";

export function CourseDetail({
  course,
  curriculum,
  configured,
  error,
}: {
  course: any;
  curriculum: any[];
  configured: boolean;
  error?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showPurchase, setShowPurchase] = useState(false);
  const isFree = String(course.access_type || "").toUpperCase() === "FREE";
  const accessType = String(course.access_type || "").toUpperCase();
  const instructor =
    typeof course.instructor === "string"
      ? course.instructor
      : text(course.instructor?.name || course.instructor_name, "");
  const thumbnail = safeResourceHref(course.thumbnail_url);

  async function start() {
    setBusy(true);
    setMessage("");
    setShowPurchase(false);
    const me = await getData("me").catch(() => ({ data: null }) as any);
    if (!me.data?.user) {
      router.push("/login");
      setBusy(false);
      return;
    }
    const access = await getData("course_access", {
      course_id: course.id,
    }).catch(() => null);
    if (!access || access.error || access.configured === false) {
      setMessage(
        access?.error ||
          "Your course access could not be checked. Please try again shortly.",
      );
      setBusy(false);
      return;
    }
    if (access.data?.allowed === true) {
      router.push(`/learn/${course.id}`);
      router.refresh();
      return;
    }
    if (isFree) {
      const result = await postAction("enroll", { course_id: course.id });
      setBusy(false);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.push(`/learn/${course.id}`);
      router.refresh();
      return;
    }
    if (accessType === "PURCHASE") {
      if (!course.product_id)
        setMessage(
          "A product is not configured for this course yet. Please contact the learning team.",
        );
      else setShowPurchase(true);
    } else if (accessType === "MEMBERSHIP") {
      router.push("/membership");
    } else {
      setMessage(
        "Access options for this course have not been configured yet.",
      );
    }
    setBusy(false);
  }

  const groups = curriculum.reduce((acc: any, item: any) => {
    const key = item.module_title || item.module_name || "Course curriculum";
    (acc[key] ??= []).push(item);
    return acc;
  }, {}) as Record<string, any[]>;

  return (
    <>
      <section className="section-sm">
        <div className="wrap">
          <Link
            href="/courses"
            className="eyebrow"
            style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
          >
            <ArrowLeft size={14} /> All courses
          </Link>
          <div className="course-detail-hero">
            <div>
              <span className="badge">{text(course.category, "Course")}</span>
              <h1
                className="display"
                style={{ fontSize: "clamp(46px,7vw,78px)", margin: "16px 0" }}
              >
                {course.title}
              </h1>
              {course.description && (
                <p className="muted" style={{ fontSize: 17, maxWidth: 650 }}>
                  {course.description}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  fontSize: 12,
                  color: "#777a87",
                  margin: "22px 0",
                }}
              >
                <span className="pill">
                  {course.level
                    ? humanize(course.level)
                    : "Level not specified"}
                </span>
                <span className="pill">
                  <Clock3 size={14} />
                  {course.estimated_minutes
                    ? `${course.estimated_minutes} minutes`
                    : "Self-paced"}
                </span>
                <span className="pill">
                  <LockKeyhole size={14} />
                  {course.access_type
                    ? humanize(course.access_type)
                    : "Access details unavailable"}
                </span>
                <span className="pill">
                  <BookOpen size={14} />
                  {configured && !error
                    ? `${curriculum.length} ${curriculum.length === 1 ? "lesson" : "lessons"}`
                    : "Lesson count unavailable"}
                </span>
                {instructor && (
                  <span className="pill">Instructor: {instructor}</span>
                )}
              </div>
              {message && (
                <div
                  role="alert"
                  className="form-alert"
                  style={{ marginBottom: 12 }}
                >
                  {message}
                </div>
              )}
              <button className="btn" onClick={start} disabled={busy}>
                {busy
                  ? "Checking your access…"
                  : isFree
                    ? "Enroll in this free course"
                    : accessType === "MEMBERSHIP"
                      ? "Explore membership access"
                      : accessType === "PURCHASE"
                        ? "Continue to purchase"
                        : "Check course access"}
                <ArrowRight size={15} />
              </button>
              <p className="field-hint" style={{ marginTop: 10 }}>
                Your access is checked before continuing. Payments are confirmed
                by the payment provider.
              </p>
              {showPurchase && (
                <div
                  className="card"
                  style={{ padding: 20, maxWidth: 460, marginTop: 18 }}
                >
                  <strong>Purchase this course</strong>
                  <p className="field-hint">
                    Checkout options are based on the published course product
                    and your account.
                  </p>
                  <PurchasePanel
                    productId={course.product_id}
                    label="Buy course"
                  />
                </div>
              )}
            </div>
            {thumbnail ? (
              <img
                className="course-detail-thumbnail"
                src={thumbnail}
                alt={text(course.title, "Course thumbnail")}
              />
            ) : (
              <div className="soft-panel course-detail-promo">
                <div className="badge badge-yellow">
                  <BookOpen size={15} /> Course pathway
                </div>
                <h2
                  className="font-display"
                  style={{ fontSize: 25, margin: "20px 0 10px" }}
                >
                  Learn. Try. Reflect.
                </h2>
                <p className="muted" style={{ fontSize: 13 }}>
                  Move through the published lessons at a pace that works for
                  you.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
      <section style={{ padding: "10px 0 78px" }}>
        <div className="wrap course-detail-content">
          <article className="card" style={{ padding: 25 }}>
            <span className="eyebrow">What you’ll explore</span>
            <h2
              className="font-display"
              style={{ fontSize: 25, margin: "10px 0 14px" }}
            >
              Course outcomes
            </h2>
            {Array.isArray(course.objectives) && course.objectives.length ? (
              <ul style={{ paddingLeft: 20, color: "#777a87", fontSize: 14 }}>
                {course.objectives.map((x: string, i: number) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    {x}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                Detailed outcomes have not been added to the published course
                information.
              </p>
            )}
            {course.prerequisites && (
              <>
                <div className="rule" style={{ margin: "20px 0" }} />
                <strong style={{ fontSize: 13 }}>Before you begin</strong>
                <p className="muted" style={{ fontSize: 13 }}>
                  {Array.isArray(course.prerequisites)
                    ? course.prerequisites.join(", ")
                    : course.prerequisites}
                </p>
              </>
            )}
          </article>
          <article className="card" style={{ padding: 25 }}>
            <span className="eyebrow">Curriculum</span>
            <h2
              className="font-display"
              style={{ fontSize: 25, margin: "10px 0 14px" }}
            >
              A look inside
            </h2>
            {error ? (
              <div className="form-alert" role="alert">
                The public curriculum could not be loaded: {error}
              </div>
            ) : !configured ? (
              <p className="muted" style={{ fontSize: 13 }}>
                The curriculum service is not configured yet.
              </p>
            ) : !curriculum.length ? (
              <p className="muted" style={{ fontSize: 13 }}>
                No lesson titles are available for this course yet.
              </p>
            ) : (
              Object.entries(groups).map(([module, items]: any) => (
                <div key={module} style={{ marginBottom: 17 }}>
                  <strong style={{ fontSize: 13 }}>{module}</strong>
                  {items.map((l: any, i: number) => (
                    <div
                      key={l.lesson_id || l.id || i}
                      className="lesson-row"
                      style={{ padding: "9px 0" }}
                    >
                      <Play size={14} color="#6657e8" />
                      <span style={{ fontSize: 13 }}>
                        {l.lesson_title || l.title}
                      </span>
                      {l.estimated_minutes && (
                        <small
                          className="field-hint"
                          style={{ marginLeft: "auto" }}
                        >
                          {l.estimated_minutes}m
                        </small>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </article>
        </div>
      </section>
      <section className="section-sm" style={{ background: "#eef0f7" }}>
        <div
          className="wrap"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="eyebrow">Ready when you are</span>
            <h2 className="display" style={{ fontSize: 34, margin: "9px 0" }}>
              Take the next small step.
            </h2>
          </div>
          <Link className="btn btn-outline" href="/register">
            Create an account <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </>
  );
}
