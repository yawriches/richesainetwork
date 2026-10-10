import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { CourseCards } from "@/components/public-data";
import { readPublic } from "@/lib/catalog";
export const metadata: Metadata = {
  title: "Courses",
  description: "Browse practical AI courses and learn at your own pace.",
};
export default async function Courses({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search = "" } = await searchParams;
  const query = search.trim().slice(0, 120);
  const catalog = await readPublic("courses", query ? { search: query } : {});
  return (
    <>
      <section className="section-sm">
        <div className="wrap">
          <span className="eyebrow">Explore the learning library</span>
          <h1
            className="display"
            style={{
              fontSize: "clamp(44px,7vw,78px)",
              maxWidth: 780,
              margin: "15px 0 20px",
            }}
          >
            Small steps. Useful skills. A path that’s yours.
          </h1>
          <p className="muted" style={{ maxWidth: 630, fontSize: 16 }}>
            Start with the fundamentals, then explore ideas you can put into
            practice. Course access and requirements are shown clearly before
            you enroll.
          </p>
        </div>
      </section>
      <section style={{ padding: "12px 0 56px" }}>
        <div className="wrap">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>
              {query ? `Courses matching “${query}”` : "Published courses"}
            </h2>
            <span className="pill">
              <BookOpen size={14} /> Current catalogue
            </span>
          </div>
          <CourseCards
            data={catalog.data}
            catalogConfigured={catalog.configured}
            error={catalog.error}
          />
        </div>
      </section>
      <section className="section-sm" style={{ background: "#eef0f7" }}>
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div>
            <span className="eyebrow">Not sure where to begin?</span>
            <h2
              className="font-display"
              style={{ fontSize: 30, margin: "8px 0" }}
            >
              Get oriented, then go at your own pace.
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              Create a free account to keep track of your learning when
              published courses are available.
            </p>
          </div>
          <Link href="/register" className="btn">
            Create free account <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
