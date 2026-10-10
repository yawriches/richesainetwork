import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { money, text, humanize } from "@/lib/ui";
import { PurchasePanel } from "./purchase-panel";
type Props = { data: any[]; catalogConfigured: boolean; error?: string };
export function CourseCards({ data, catalogConfigured, error }: Props) {
  if (!catalogConfigured || error)
    return (
      <div className="soft-panel">
        <strong>The course catalogue is taking a moment.</strong>
        <p className="muted">
          Published course information could not be loaded. Please check back
          shortly.
        </p>
      </div>
    );
  if (!data.length)
    return (
      <div
        className="soft-panel"
        style={{ display: "flex", gap: 16, alignItems: "flex-start" }}
      >
        <span className="badge badge-yellow">
          <BookOpen size={15} />
        </span>
        <div>
          <strong>New lessons are taking shape.</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            No courses are published yet. Create a free account to be ready when
            the first course arrives.
          </p>
          <Link
            className="link-under"
            href="/register"
            style={{
              display: "inline-flex",
              marginTop: 12,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Create a free account <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  return (
    <div className="grid-3">
      {data.slice(0, 3).map((c) => (
        <Link
          href={`/courses/${c.slug}`}
          className="card"
          key={c.id}
          style={{
            padding: 23,
            display: "flex",
            flexDirection: "column",
            minHeight: 235,
          }}
        >
          {c.thumbnail_url && (
            <img
              src={c.thumbnail_url}
              alt=""
              loading="lazy"
              style={{
                width: "100%",
                aspectRatio: "16/9",
                objectFit: "cover",
                borderRadius: 12,
                marginBottom: 18,
              }}
            />
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="badge">{text(c.category, "AI skills")}</span>
            <ArrowRight size={17} />
          </div>
          <h3
            className="font-display"
            style={{
              fontSize: 22,
              lineHeight: 1.15,
              letterSpacing: "-.04em",
              margin: "25px 0 8px",
            }}
          >
            {c.title}
          </h3>
          {c.description && (
            <p className="muted" style={{ fontSize: 13, margin: "0 0 22px" }}>
              {c.description.slice(0, 105)}
              {c.description.length > 105 ? "…" : ""}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: "auto",
              fontSize: 11,
              color: "#777a87",
              flexWrap: "wrap",
            }}
          >
            <span>{humanize(c.level || "BEGINNER")}</span>
            <span>
              {c.estimated_minutes
                ? `${c.estimated_minutes} min`
                : "Self-paced"}
            </span>
            <span>{humanize(c.access_type)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
export function PlanCards({ data, catalogConfigured, error }: Props) {
  if (!catalogConfigured || error)
    return (
      <div className="soft-panel">
        <strong>Plan details could not be loaded.</strong>
        <p className="muted">
          Please check back later. We only show actual published pricing.
        </p>
      </div>
    );
  if (!data.length)
    return (
      <div className="soft-panel">
        <strong>Start with learning, not a commitment.</strong>
        <p className="muted">
          No membership plans are active yet. Free courses are clearly marked in
          the catalogue.
        </p>
      </div>
    );
  return (
    <div className="grid-3">
      {data.map((p) => (
        <article
          className="card"
          key={p.id}
          style={{ padding: 25, display: "flex", flexDirection: "column" }}
        >
          <span className="eyebrow">Membership</span>
          <h3
            className="font-display"
            style={{
              fontSize: 27,
              margin: "12px 0 5px",
              letterSpacing: "-.04em",
            }}
          >
            {p.name}
          </h3>
          {p.description && (
            <p className="muted" style={{ fontSize: 13 }}>
              {p.description}
            </p>
          )}
          <strong
            className="font-display"
            style={{ fontSize: 30, margin: "8px 0" }}
          >
            {p.price != null
              ? money(p.price, p.currency, p.minor_units)
              : "Price confirmed at checkout"}
            <small
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 400,
                color: "#777a87",
              }}
            >
              {" "}
              / {p.billing_months} {p.billing_months === 1 ? "month" : "months"}
            </small>
          </strong>
          <ul
            style={{
              paddingLeft: 18,
              fontSize: 13,
              color: "#777a87",
              margin: "12px 0 22px",
            }}
          >
            <li style={{ marginBottom: 7 }}>
              {p.included_reviews} technical reviews per paid period; no
              rollover
            </li>
            {Array.isArray(p.benefits) &&
              p.benefits.map((benefit: string, i: number) => (
                <li key={i} style={{ marginBottom: 7 }}>
                  {benefit}
                </li>
              ))}
          </ul>
          <PurchasePanel
            productId={p.product_id}
            priceId={p.price_id}
            plan={p}
            label="Choose this plan"
          />
        </article>
      ))}
    </div>
  );
}
