"use client";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Archive,
  Bot,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coins,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { Wordmark } from "@/components/site";
import { LessonVideo } from "@/components/lesson-video";
import { CommunityControlCenter } from "@/components/admin-community";
import { AiSupportControlCenter } from "@/components/admin-ai-support";
import { MentorshipControlCenter } from "@/components/admin-mentorship";
import { getYouTubeVideo } from "@/lib/lesson-video";
import {
  ManualCourseGrant,
  ExistingRefundImport,
} from "@/components/admin-operations";
import {
  asArray,
  formatDate,
  getData,
  localDateTimeValue,
  postAction,
  recordValue,
  text,
} from "@/lib/ui";

type Section = { label: string; table?: string; icon: any; readonly?: boolean };
const sections: Record<string, Section> = {
  overview: { label: "Overview", icon: LayoutDashboard },
  community: { label: "Community control", icon: Shield },
  ai_support: { label: "AI support", icon: Bot },
  mentorship: { label: "Mentorship applications", icon: BriefcaseBusiness },
  courses: { label: "Courses", table: "courses", icon: BookOpen },
  modules: { label: "Course modules", table: "course_modules", icon: BookOpen },
  lessons: { label: "Lessons", table: "lessons", icon: BookOpen },
  resources: {
    label: "Course resources",
    table: "course_resources",
    icon: FileText,
  },
  products: { label: "Products", table: "products", icon: BriefcaseBusiness },
  pricing: { label: "Product pricing", table: "product_prices", icon: Wallet },
  memberships: {
    label: "Membership plans",
    table: "membership_plans",
    icon: Shield,
  },
  reviews: {
    label: "Review queue",
    table: "review_submissions",
    icon: MessageSquareText,
  },
  credits: { label: "Review credits", table: "profiles", icon: Coins },
  support: {
    label: "Support packages",
    table: "support_packages",
    icon: BriefcaseBusiness,
  },
  availability: {
    label: "Availability",
    table: "availability",
    icon: CalendarDays,
  },
  appointments: {
    label: "Appointments",
    table: "appointments",
    icon: CalendarDays,
  },
  events: { label: "Events", table: "events", icon: CalendarDays },
  drops: { label: "AI drops", table: "ai_drops", icon: MessageSquareText },
  announcements: {
    label: "Announcements",
    table: "announcements",
    icon: MessageSquareText,
  },
  community_reports: {
    label: "Community reports",
    table: "community_reports",
    icon: MessageSquareText,
    readonly: true,
  },
  users: { label: "People", table: "profiles", icon: Users },
  subscriptions: {
    label: "Subscriptions",
    table: "subscriptions",
    icon: Wallet,
    readonly: true,
  },
  orders: { label: "Orders", table: "orders", icon: Wallet, readonly: true },
  payments: {
    label: "Payments",
    table: "payments",
    icon: Wallet,
    readonly: true,
  },
  refunds: {
    label: "Refund history",
    table: "payment_refunds",
    icon: Wallet,
    readonly: true,
  },
  points: { label: "Points rules", table: "points_rules", icon: Coins },
  badges: { label: "Badges", table: "badges", icon: Shield },
  settings: {
    label: "Business settings",
    table: "business_settings",
    icon: Settings,
  },
  countries: {
    label: "Countries & currency",
    table: "countries",
    icon: Settings,
  },
  currencies: { label: "Currencies", table: "currencies", icon: Wallet },
  providers: {
    label: "Payment providers",
    table: "payment_providers",
    icon: Wallet,
  },
  categories: {
    label: "Project categories",
    table: "project_categories",
    icon: Settings,
  },
  review_categories: {
    label: "Review categories",
    table: "review_categories",
    icon: Settings,
  },
  scoring: {
    label: "Scoring criteria",
    table: "review_scoring_criteria",
    icon: Settings,
  },
  notifications: {
    label: "Notification settings",
    table: "business_settings",
    icon: Settings,
  },
  audit: {
    label: "Audit log",
    table: "audit_logs",
    icon: FileText,
    readonly: true,
  },
};
sections.inbox = {
  label: "Contact inbox",
  table: "contact_messages",
  icon: MessageSquareText,
};
const navGroups = [
  { title: "Learning", ids: ["courses", "modules", "lessons", "resources"] },
  {
    title: "Commerce",
    ids: [
      "products",
      "pricing",
      "memberships",
      "orders",
      "payments",
      "subscriptions",
    ],
  },
  {
    title: "Learner support",
    ids: ["reviews", "credits", "support", "availability", "appointments", "ai_support", "mentorship"],
  },
  {
    title: "Community",
    ids: ["community", "events", "drops", "announcements", "community_reports"],
  },
  {
    title: "Operations",
    ids: [
      "users",
      "settings",
      "countries",
      "currencies",
      "providers",
      "categories",
      "review_categories",
      "scoring",
      "points",
      "badges",
      "notifications",
      "inbox",
      "audit",
    ],
  },
];
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  hint?: string;
  required?: boolean;
  upload?:
    "course-thumbnail" | "lesson-video" | "course-resource" | "drop-resource";
};
function Notice({
  children,
  type = "note",
}: {
  children: ReactNode;
  type?: "note" | "error";
}) {
  return (
    <div
      className={type === "error" ? "form-alert" : "soft-panel"}
      role={type === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
const fields: Record<string, Field[]> = {
  profiles: [
    { key: "name", label: "Name", required: true },
    { key: "country_code", label: "Country", type: "countries" },
    {
      key: "status",
      label: "Account status",
      options: ["ACTIVE", "SUSPENDED"],
    },
  ],
  appointments: [
    {
      key: "status",
      label: "Appointment status",
      options: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
    },
    { key: "starts_at", label: "Starts at (local time)", type: "datetime" },
    { key: "ends_at", label: "Ends at (local time)", type: "datetime" },
    {
      key: "meeting_url",
      label: "Private meeting link (participants/admin only)",
    },
  ],
  points_rules: [
    { key: "event_key", label: "Event key", required: true },
    { key: "name", label: "Rule name", required: true },
    {
      key: "points",
      label: "Points (not cash)",
      type: "number",
      required: true,
    },
    { key: "active", label: "Enabled", type: "boolean" },
  ],
  badges: [
    { key: "key", label: "Badge key", required: true },
    { key: "name", label: "Badge name", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "icon_url", label: "Icon URL" },
    { key: "active", label: "Enabled", type: "boolean" },
  ],
  courses: [
    { key: "title", label: "Course title", required: true },
    { key: "slug", label: "URL slug", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "instructor", label: "Instructor" },
    { key: "category", label: "Category", required: true },
    {
      key: "level",
      label: "Level",
      options: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    },
    {
      key: "access_type",
      label: "Access",
      options: ["FREE", "PURCHASE", "MEMBERSHIP"],
    },
    {
      key: "status",
      label: "Publication status",
      options: ["DRAFT", "PUBLISHED", "ARCHIVED"],
    },
    { key: "featured", label: "Featured course", type: "boolean" },
    { key: "estimated_minutes", label: "Estimated minutes", type: "number" },
    {
      key: "objectives",
      label: "Course outcomes (one per line)",
      type: "lines",
    },
    { key: "prerequisites", label: "Prerequisites", type: "textarea" },
    {
      key: "thumbnail_url",
      label: "Thumbnail image",
      type: "upload",
      upload: "course-thumbnail",
    },
    {
      key: "product_id",
      label: "Associated course product (optional)",
      type: "products",
    },
  ],
  course_modules: [
    { key: "course_id", label: "Course", type: "courses", required: true },
    { key: "title", label: "Module title", required: true },
    { key: "sort_order", label: "Display order", type: "number" },
  ],
  lessons: [
    { key: "module_id", label: "Module", type: "modules", required: true },
    { key: "title", label: "Lesson title", required: true },
    { key: "body", label: "Lesson content", type: "textarea" },
    {
      key: "video_url",
      label: "Lesson video (YouTube link or upload)",
      type: "upload",
      upload: "lesson-video",
      hint: "Paste a YouTube share/watch link or direct HTTPS video URL, or upload a protected video. YouTube videos must allow embedding; their visibility is controlled by YouTube, not course storage.",
    },
    {
      key: "resources",
      label: "Additional resources (one per line)",
      type: "lines",
    },
    { key: "exercise", label: "Exercise", type: "textarea" },
    { key: "prompt", label: "Prompt or practice material", type: "textarea" },
    { key: "sort_order", label: "Display order", type: "number" },
  ],
  course_resources: [
    { key: "course_id", label: "Course", type: "courses", required: true },
    { key: "title", label: "Resource title", required: true },
    {
      key: "resource_type",
      label: "Resource type",
      options: ["FILE", "IMAGE", "LINK", "VIDEO"],
    },
    { key: "external_url", label: "External URL" },
    {
      key: "storage_path",
      label: "Protected resource file",
      type: "upload",
      upload: "course-resource",
    },
    { key: "sort_order", label: "Display order", type: "number" },
  ],
  products: [
    { key: "name", label: "Product name", required: true },
    {
      key: "type",
      label: "Product type",
      options: ["COURSE", "MEMBERSHIP", "REVIEW", "SUPPORT"],
    },
    {
      key: "status",
      label: "Status",
      options: ["ACTIVE", "PAUSED", "ARCHIVED"],
    },
    {
      key: "review_credit_quantity",
      label: "Review credit quantity",
      type: "number",
      required: true,
    },
  ],
  product_prices: [
    { key: "product_id", label: "Product", type: "products", required: true },
    {
      key: "amount",
      label: "Amount in major currency units",
      type: "major_amount",
      required: true,
      hint: "Storage uses configured minor units; the amount is converted using this currency’s minor_units.",
    },
    {
      key: "currency",
      label: "Currency code",
      type: "currencies",
      required: true,
    },
    { key: "country_code", label: "Country", type: "countries" },
    {
      key: "billing_interval",
      label: "Billing interval",
      options: ["ONCE", "MONTH", "YEAR"],
    },
    { key: "billing_interval_count", label: "Interval count", type: "number" },
    {
      key: "status",
      label: "Status",
      options: ["ACTIVE", "PAUSED", "ARCHIVED"],
    },
    { key: "starts_at", label: "Starts at", type: "datetime" },
    { key: "ends_at", label: "Ends at", type: "datetime" },
    { key: "sort_order", label: "Sort order", type: "number" },
  ],
  membership_plans: [
    { key: "name", label: "Plan name", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "product_id", label: "Product", type: "products", required: true },
    { key: "price_id", label: "Price", type: "prices", required: true },
    { key: "included_reviews", label: "Included reviews", type: "number" },
    {
      key: "billing_months",
      label: "Billing period in months",
      type: "number",
      required: true,
    },
    {
      key: "status",
      label: "Status",
      options: ["ACTIVE", "INACTIVE", "PAUSED", "ARCHIVED"],
    },
    { key: "benefits", label: "Benefits (one per line)", type: "lines" },
    {
      key: "countries",
      label: "Available country codes (one per line)",
      type: "lines",
    },
    { key: "providers", label: "Provider codes (one per line)", type: "lines" },
  ],
  support_packages: [
    { key: "name", label: "Package name", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "product_id", label: "Product", type: "products", required: true },
    { key: "price_id", label: "Price", type: "prices", required: true },
    {
      key: "duration_minutes",
      label: "Duration in minutes",
      type: "number",
      required: true,
    },
    {
      key: "status",
      label: "Status",
      options: ["ACTIVE", "INACTIVE", "PAUSED", "ARCHIVED"],
    },
  ],
  availability: [
    {
      key: "package_id",
      label: "Support package",
      type: "support_packages",
      required: true,
    },
    { key: "starts_at", label: "Starts at", type: "datetime", required: true },
    { key: "ends_at", label: "Ends at", type: "datetime", required: true },
    { key: "capacity", label: "Capacity", type: "number" },
    { key: "meeting_url", label: "Meeting link (participant/admin only)" },
    {
      key: "status",
      label: "Slot status",
      options: ["OPEN", "BLOCKED", "CLOSED"],
    },
  ],
  ai_drops: [
    { key: "title", label: "Title", required: true },
    { key: "description", label: "Description", type: "textarea" },
    {
      key: "type",
      label: "Type",
      options: [
        "PROMPT",
        "TOOL",
        "TUTORIAL",
        "TEMPLATE",
        "RESOURCE",
        "WORKFLOW",
        "NEWS",
      ],
    },
    { key: "url", label: "Public resource URL" },
    {
      key: "thumbnail_url",
      label: "Thumbnail image",
      type: "upload",
      upload: "course-thumbnail",
    },
    {
      key: "resource_path",
      label: "Protected drop media",
      type: "upload",
      upload: "drop-resource",
    },
    { key: "audience", label: "Audience", options: ["PUBLIC", "MEMBERS"] },
    {
      key: "status",
      label: "Status",
      options: ["DRAFT", "PUBLISHED", "CANCELLED"],
    },
    { key: "publish_at", label: "Publish at", type: "datetime" },
  ],
  events: [
    { key: "title", label: "Event title", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "starts_at", label: "Starts at", type: "datetime" },
    { key: "ends_at", label: "Ends at", type: "datetime" },
    { key: "audience", label: "Audience", options: ["PUBLIC", "MEMBERS"] },
    {
      key: "status",
      label: "Status",
      options: ["DRAFT", "PUBLISHED", "CANCELLED"],
    },
    { key: "publish_at", label: "Publish at", type: "datetime" },
    { key: "url", label: "Event registration URL" },
    {
      key: "meeting_url",
      label: "Private meeting link (participants/admin only)",
      hint: "Private participant/admin link only. Leave blank until the link is confirmed; there is no automatic default.",
    },
    {
      key: "thumbnail_url",
      label: "Thumbnail image",
      type: "upload",
      upload: "course-thumbnail",
    },
    { key: "recording_url", label: "Recording URL" },
    { key: "resources", label: "Resources (one URL per line)", type: "lines" },
  ],
  announcements: [
    { key: "title", label: "Title", required: true },
    { key: "description", label: "Message", type: "textarea" },
    { key: "audience", label: "Audience", options: ["PUBLIC", "MEMBERS"] },
    {
      key: "status",
      label: "Status",
      options: ["DRAFT", "PUBLISHED", "CANCELLED"],
    },
    { key: "publish_at", label: "Publish at", type: "datetime" },
    { key: "url", label: "Action URL" },
  ],
  business_settings: [
    { key: "key", label: "Setting key", required: true },
    { key: "value", label: "Setting value", type: "setting_value" },
    {
      key: "type",
      label: "Value type",
      options: [
        "NUMBER",
        "BOOLEAN",
        "STRING",
        "JSON",
        "DURATION",
        "CURRENCY",
        "PERCENTAGE",
        "URL",
      ],
    },
    {
      key: "category",
      label: "Setting category",
      hint: "Preserve the existing category (for example booking, membership, storage, general, or public).",
    },
    { key: "description", label: "Description", type: "textarea" },
    { key: "active", label: "Active", type: "boolean" },
  ],
  countries: [
    { key: "code", label: "ISO country code", required: true },
    { key: "name", label: "Country name", required: true },
    {
      key: "currency_code",
      label: "Currency code",
      type: "currencies",
      required: true,
    },
    { key: "active", label: "Enabled", type: "boolean" },
  ],
  currencies: [
    { key: "code", label: "ISO currency code", required: true },
    { key: "name", label: "Currency name", required: true },
    {
      key: "minor_units",
      label: "Minor units (0–4)",
      type: "number",
      required: true,
    },
  ],
  payment_providers: [
    {
      key: "code",
      label: "Provider code",
      required: true,
      options: ["PAYSTACK", "KORA"],
    },
    { key: "name", label: "Provider name", required: true },
    {
      key: "enabled",
      label: "Enabled by business configuration",
      type: "boolean",
      hint: "Availability also depends on backend provider readiness and country support.",
    },
    { key: "countries", label: "Country codes (one per line)", type: "lines" },
    {
      key: "currencies",
      label: "Currency codes (one per line)",
      type: "lines",
    },
    { key: "methods", label: "Payment methods (one per line)", type: "lines" },
    { key: "recurring_enabled", label: "Recurring enabled", type: "boolean" },
  ],
  project_categories: [
    { key: "category", label: "Category code", required: true },
    { key: "label", label: "Display label", required: true },
    { key: "sort_order", label: "Display order", type: "number" },
    { key: "active", label: "Enabled", type: "boolean" },
  ],
  review_categories: [
    { key: "category", label: "Category code", required: true },
    { key: "label", label: "Display label", required: true },
    { key: "sort_order", label: "Display order", type: "number" },
    { key: "active", label: "Enabled", type: "boolean" },
  ],
  review_scoring_criteria: [
    {
      key: "category",
      label: "Review category",
      type: "review_categories",
      required: true,
    },
    { key: "criterion_key", label: "Criterion key", required: true },
    { key: "label", label: "Display label", required: true },
    { key: "description", label: "Description", type: "textarea" },
    {
      key: "max_score",
      label: "Maximum score",
      type: "number",
      required: true,
    },
    { key: "sort_order", label: "Display order", type: "number" },
    { key: "active", label: "Enabled", type: "boolean" },
  ],
  contact_messages: [
    { key: "status", label: "Message status", options: ["OPEN", "CLOSED"] },
  ],
};

type Lookups = {
  courses: any[];
  modules: any[];
  products: any[];
  prices: any[];
  support_packages: any[];
  countries: any[];
  currencies: any[];
  review_categories: any[];
};
function FieldInput({
  f,
  value,
  onChange,
  lookups,
  settingType,
}: {
  f: Field;
  value: any;
  onChange: (v: any) => void;
  lookups: Lookups;
  settingType?: string;
}) {
  const id = `field-${f.key}`;
  const current = value ?? "";
  if (f.type === "boolean")
    return (
      <div className="field">
        <label htmlFor={id}>{f.label}</label>
        <select
          id={id}
          name={f.key}
          className="select"
          value={String(value ?? false)}
          onChange={(e) => onChange(e.target.value === "true")}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  if (f.type === "setting_value") {
    const type = String(settingType || "STRING").toUpperCase();
    const isJson = type === "JSON";
    const isBoolean = type === "BOOLEAN";
    const isNumeric = ["NUMBER", "DURATION", "PERCENTAGE"].includes(type);
    const shown =
      isJson && typeof current !== "string"
        ? JSON.stringify(current, null, 2)
        : isBoolean
          ? String(current === true || current === "true")
          : String(current);
    return (
      <div className="field">
        <label htmlFor={id}>{f.label}</label>
        {isBoolean ? (
          <select
            id={id}
            name={f.key}
            className="select"
            value={shown}
            onChange={(e) => onChange(e.target.value === "true")}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        ) : isJson ? (
          <textarea
            id={id}
            name={f.key}
            className="textarea"
            rows={5}
            value={shown}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            id={id}
            name={f.key}
            className="input"
            type={isNumeric ? "number" : "text"}
            step={isNumeric ? "any" : undefined}
            value={shown}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <span className="field-hint">
          {f.hint}
          {type === "DURATION"
            ? " Value is stored in the configured duration unit."
            : type === "PERCENTAGE"
              ? " Enter a value from 0 to 100."
              : ""}
        </span>
      </div>
    );
  }
  if (f.options) {
    const options = [
      ...new Set([
        ...f.options,
        ...(value && !f.options.includes(String(value)) ? [String(value)] : []),
      ]),
    ];
    return (
      <div className="field">
        <label htmlFor={id}>{f.label}</label>
        <select
          id={id}
          name={f.key}
          className="select"
          required={f.required}
          value={String(value ?? options[0] ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        {f.hint && <span className="field-hint">{f.hint}</span>}
      </div>
    );
  }
  const lookupKey = (
    {
      courses: "courses",
      modules: "modules",
      products: "products",
      prices: "prices",
      support_packages: "support_packages",
      countries: "countries",
      currencies: "currencies",
      review_categories: "review_categories",
    } as Record<string, string>
  )[f.type || ""];
  if (lookupKey) {
    const options = lookups[lookupKey as keyof Lookups] || [];
    const optional = !f.required;
    return (
      <div className="field">
        <label htmlFor={id}>{f.label}</label>
        <select
          id={id}
          name={f.key}
          className="select"
          required={f.required}
          value={current == null ? "" : String(current)}
          onChange={(e) => onChange(e.target.value)}
        >
          {optional ? (
            <option value="">None</option>
          ) : (
            <option value="">Choose…</option>
          )}
          {options.map((x: any) => (
            <option
              key={x.id || x.code || x.category}
              value={x.id || x.code || x.category}
            >
              {x.title || x.name || x.label || x.code || x.category}
            </option>
          ))}
        </select>
        {options.length === 0 && (
          <span className="field-hint">
            No matching records are available in this lookup.
          </span>
        )}
        {f.hint && <span className="field-hint">{f.hint}</span>}
      </div>
    );
  }
  const type =
    f.type === "number" || f.type === "major_amount"
      ? "number"
      : f.type === "datetime"
        ? "datetime-local"
        : "text";
  const shown =
    f.type === "datetime"
      ? localDateTimeValue(current)
      : Array.isArray(current)
        ? current.join("\n")
        : current;
  const step =
    f.type === "major_amount" ? "any" : f.type === "number" ? "any" : undefined;
  const props = {
    id,
    name: f.key,
    required: f.required,
    step,
    value: shown,
    onChange: (e: any) => onChange(e.target.value),
    className:
      f.type === "textarea" || f.type === "lines" ? "textarea" : "input",
  };
  return (
    <div className="field">
      <label htmlFor={id}>{f.label}</label>
      {f.type === "textarea" || f.type === "lines" ? (
        <textarea {...props} rows={f.type === "lines" ? 4 : 5} />
      ) : (
        <input {...props} type={type} />
      )}
      {f.hint && <span className="field-hint">{f.hint}</span>}
    </div>
  );
}

function FieldUpload({
  f,
  value,
  onChange,
  record,
  lookups,
}: {
  f: Field;
  value: any;
  onChange: (v: any) => void;
  record: any;
  lookups: Lookups;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || !f.upload) return;
    const module = lookups.modules.find((m) => m.id === record?.module_id);
    const courseId = record?.course_id || module?.course_id;
    const dropId = record?.id;
    if (["lesson-video", "course-resource"].includes(f.upload) && !courseId) {
      setError(
        "Choose the course or lesson module before uploading this protected file.",
      );
      input.value = "";
      return;
    }
    if (f.upload === "drop-resource" && !dropId) {
      setError(
        "Save this AI drop first, then edit it to upload protected media.",
      );
      input.value = "";
      return;
    }
    setBusy(true);
    setError("");
    const data = new FormData();
    data.append("file", file);
    const bucket =
      f.upload === "course-thumbnail"
        ? "course-thumbnails"
        : f.upload === "drop-resource"
          ? "ai-drop-media"
          : "course-assets";
    data.append("bucket", bucket);
    if (courseId) data.append("course_id", courseId);
    if (dropId) data.append("drop_id", dropId);
    try {
      const response = await fetch("/api/assets/upload", {
        method: "POST",
        credentials: "same-origin",
        body: data,
      });
      const result = await response.json().catch(() => ({
        ok: false,
        error: "The upload response could not be read.",
      }));
      if (!response.ok || result.ok !== true)
        setError(result.error || "The file could not be uploaded.");
      else {
        const stored =
          f.upload === "course-thumbnail"
            ? result.data?.url
            : result.data?.storage_path || result.data?.path;
        if (!stored)
          setError("The upload service did not return a storage location.");
        else onChange(stored);
      }
    } catch {
      setError("The upload service could not be reached.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  const accept =
    f.upload === "course-thumbnail"
      ? "image/*"
      : f.upload === "lesson-video"
        ? "video/*"
        : ".pdf,image/*,video/*";
  return (
    <div className="field">
      <label htmlFor={`field-${f.key}`}>{f.label}</label>
      <input
        id={`field-${f.key}`}
        name={f.key}
        className="input"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          f.upload === "lesson-video"
            ? "https://youtu.be/… or upload a video"
            : "Upload or enter a configured URL/path"
        }
      />
      {f.hint && <span className="field-hint">{f.hint}</span>}
      {f.upload === "lesson-video" && getYouTubeVideo(value) && (
        <LessonVideo
          src={String(value)}
          title={record?.title || "Lesson preview"}
        />
      )}
      <input
        aria-label={`Upload ${f.label.toLowerCase()}`}
        className="input"
        type="file"
        accept={accept}
        onChange={upload}
        disabled={busy}
      />
      <span className="field-hint">
        {busy
          ? "Uploading to the configured private/public bucket…"
          : "Only this field’s configured media bucket is accepted."}
      </span>
      {error && (
        <span className="form-alert" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    getData("me")
      .then((r) => {
        setAuth(r.data);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);
  if (!checked)
    return (
      <div className="auth-wrap">
        <div className="loading">Checking administrator access…</div>
      </div>
    );
  if (!auth?.user || String(auth.profile?.role || "").toUpperCase() !== "ADMIN")
    return (
      <div className="auth-wrap">
        <section className="card auth-card">
          <Wordmark />
          <span className="eyebrow" style={{ display: "block", marginTop: 28 }}>
            Restricted operations
          </span>
          <h1 className="display" style={{ fontSize: 34 }}>
            Administrator access required.
          </h1>
          <p className="muted">
            The operations centre is limited to authorized administrators. The
            server remains the source of truth for access.
          </p>
          <Link className="btn" href="/login">
            Sign in <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    );
  return <>{children}</>;
}

export function AdminApp({ section = "overview" }: { section?: string }) {
  const [search, setSearch] = useState("");
  const data = sections[section] || sections.overview;
  const readOnly = Boolean(
    data.readonly ||
    ["subscriptions", "orders", "payments", "audit"].includes(section),
  );
  return (
    <div className="admin-layout">
      <aside className="admin-side">
        <Wordmark light />
        <div className="admin-brand-note admin-brand-title">
          Network operations
        </div>
        <nav className="portal-nav" aria-label="Administration">
          <Link
            href="/admin"
            aria-current={section === "overview" ? "page" : undefined}
          >
            <LayoutDashboard size={17} />
            Overview
          </Link>
          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="admin-brand-note admin-group-label">
                {group.title}
              </div>
              {group.ids.map((id) => {
                const s = sections[id];
                return (
                  <Link
                    key={id}
                    href={`/admin/${id}`}
                    aria-current={section === id ? "page" : undefined}
                  >
                    <s.icon size={16} />
                    {s.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <Link
          href="/dashboard"
          className="admin-back-link"
        >
          ← Back to learning
        </Link>
      </aside>
      <main className="admin-main">
        <div
            className="admin-page-header"
        >
          <div>
            <span className="eyebrow">Riches AI Network / Operations</span>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(32px,4vw,48px)",
                margin: "5px 0",
                letterSpacing: "-.05em",
              }}
            >
              {data.label}
            </h1>
          </div>
          {(data.table || ["community", "ai_support", "mentorship"].includes(section)) && (
            <div className="admin-record-search">
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: 12,
                  top: 12,
                  color: "#9a9daa",
                }}
              />
              <input
                className="input"
                name="search"
                placeholder="Search records"
                aria-label="Search records"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
          )}
        </div>
        {section === "overview" ? (
          <AdminOverview />
        ) : (
          <section>
            <p
              className="muted"
              style={{ margin: "-10px 0 23px", fontSize: 13 }}
            >
              Live records and changes from the connected network. Only
              published or enabled items appear on public pages.
            </p>
            {section === "reviews" ? (
              <ReviewQueue search={search} />
            ) : section === "credits" ? (
              <CreditManager search={search} />
            ) : section === "community" ? (
              <CommunityControlCenter search={search} />
            ) : section === "ai_support" ? (
              <AiSupportControlCenter search={search} />
            ) : section === "mentorship" ? (
              <MentorshipControlCenter search={search} />
            ) : data.table ? (
              <TableManager
                table={data.table}
                readOnly={readOnly}
                search={search}
                filter={
                  section === "notifications" ? "notifications" : undefined
                }
                disableCreate={section === "inbox"}
              />
            ) : (
              <AdminOverview />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function AdminOverview() {
  const [initialRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      from: localDateTimeValue(start.toISOString()),
      to: localDateTimeValue(end.toISOString()),
    };
  });
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [state, setState] = useState<any>({ loading: true });
  const [rangeError, setRangeError] = useState("");
  async function load(fromValue: string, toValue: string) {
    const start = new Date(fromValue);
    const end = new Date(toValue);
    if (
      !fromValue ||
      !toValue ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    ) {
      setRangeError("Choose a valid start time before the end time.");
      return;
    }
    setRangeError("");
    setState((s: any) => ({ ...s, loading: true }));
    try {
      const [a, p] = await Promise.all([
        getData("analytics", {
          from: start.toISOString(),
          to: end.toISOString(),
        }),
        getData("payment_readiness"),
      ]);
      setState({
        loading: false,
        analytics: a.data || {},
        readiness: p.data || {},
        error: a.error || "",
      });
    } catch {
      setState({
        loading: false,
        error: "Live operations data could not be loaded.",
      });
    }
  }
  useEffect(() => {
    void load(initialRange.from, initialRange.to);
  }, []);
  const a = state.analytics || {};
  const metricDefinitions: [string, string][] = [
    ["users_total", "Registered accounts"],
    ["new_users", "New accounts in period"],
    ["active_users", "Active users in period"],
    ["paying_users", "Paying users in period"],
    ["active_members", "Current memberships"],
    ["pending_reviews", "Reviews needing attention"],
    ["overdue_reviews", "Overdue reviews"],
    ["upcoming_appointments", "Upcoming appointments"],
  ];
  const metrics = metricDefinitions.filter(
    ([key]) => a[key] !== undefined && a[key] !== null,
  );
  if (state.loading && !state.analytics)
    return <p className="loading">Loading live network activity…</p>;
  if (state.error)
    return (
      <div className="form-alert" role="alert">
        {state.error}
      </div>
    );
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(from, to);
        }}
        className="card admin-overview-filter"
        style={{
          padding: 16,
          display: "flex",
          alignItems: "end",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="analytics-from">From</label>
          <input
            id="analytics-from"
            name="from"
            type="datetime-local"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="analytics-to">To</label>
          <input
            id="analytics-to"
            name="to"
            type="datetime-local"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>
        <button className="btn" disabled={state.loading}>
          {state.loading ? "Loading…" : "Apply date range"}
        </button>
        {rangeError && (
          <span className="form-alert" role="alert">
            {rangeError}
          </span>
        )}
      </form>
      <div className="grid-3 admin-overview-metrics">
        {metrics.map(([key, label]) => (
          <article className="card stat-card" key={key}>
            <span className="field-hint">{label}</span>
            <div className="stat-value">{a[key]}</div>
          </article>
        ))}
      </div>
      <div className="grid-2 admin-overview-panels" style={{ marginTop: 22 }}>
        <section className="card" style={{ padding: 22 }}>
          <span className="eyebrow">Verified payments only</span>
          <h2
            className="font-display"
            style={{ fontSize: 22, margin: "8px 0 14px" }}
          >
            Revenue by currency
          </h2>
          {a.revenue_by_currency?.length ? (
            a.revenue_by_currency.map((r: any) => (
              <div
                className="lesson-row"
                key={r.currency}
                style={{ paddingInline: 0 }}
              >
                <strong>{r.currency}</strong>
                <span style={{ marginLeft: "auto" }}>
                  {Number(r.amount_minor).toLocaleString()} minor units
                </span>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              No verified payment totals returned for this period. Pending
              attempts are not counted.
            </p>
          )}
        </section>
        <section className="card" style={{ padding: 22 }}>
          <span className="eyebrow">Provider readiness</span>
          <h2
            className="font-display"
            style={{ fontSize: 22, margin: "8px 0 14px" }}
          >
            Payment setup
          </h2>
          {state.readiness?.providers?.length ? (
            state.readiness.providers.map((p: any) => (
              <div
                className="lesson-row"
                key={p.code}
                style={{ paddingInline: 0 }}
              >
                <span>{p.name || p.code}</span>
                <span
                  className={`badge ${p.ready ? "badge-yellow" : "badge-quiet"}`}
                  style={{ marginLeft: "auto" }}
                >
                  {p.ready ? "Ready" : "Not ready"}
                </span>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              Payment options remain unavailable until the backend confirms
              credentials and supported regions.
            </p>
          )}
          <Link
            className="link-under"
            href="/admin/providers"
            style={{ fontSize: 12, fontWeight: 700 }}
          >
            Configure provider settings
          </Link>
        </section>
      </div>
      {Array.isArray(a.popular_courses) && (
        <section className="card" style={{ padding: 22, marginTop: 22 }}>
          <span className="eyebrow">Enrollment activity</span>
          <h2
            className="font-display"
            style={{ fontSize: 22, margin: "8px 0 14px" }}
          >
            Popular courses
          </h2>
          {a.popular_courses.length ? (
            a.popular_courses.map((r: any) => (
              <div
                className="lesson-row"
                key={r.course_id}
                style={{ paddingInline: 0 }}
              >
                <strong>{r.title}</strong>
                <span style={{ marginLeft: "auto" }}>
                  {r.enrollments} enrollments
                </span>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              No popular course data returned for this period.
            </p>
          )}
        </section>
      )}
      {Array.isArray(a.revenue_by_product) && (
        <section className="card" style={{ padding: 22, marginTop: 22 }}>
          <span className="eyebrow">Verified payments only</span>
          <h2
            className="font-display"
            style={{ fontSize: 22, margin: "8px 0 14px" }}
          >
            Revenue by product
          </h2>
          {a.revenue_by_product.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Currency</th>
                    <th>Revenue (minor units)</th>
                  </tr>
                </thead>
                <tbody>
                  {a.revenue_by_product.map((r: any, i: number) => (
                    <tr key={`${r.product_id}-${r.currency}-${i}`}>
                      <td>{r.product_name}</td>
                      <td>{r.currency}</td>
                      <td>{Number(r.amount_minor).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              No verified product revenue returned for this period.
            </p>
          )}
        </section>
      )}
      <div className="soft-panel" style={{ marginTop: 22 }}>
        <strong>Publishing safeguard</strong>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#777a87" }}>
          Draft courses and unpublished community content remain private.
          Changes are saved to the database; publish only after checking
          content, access, price, and region settings.
        </p>
      </div>
    </>
  );
}

function primaryKey(table: string) {
  if (table === "business_settings") return "key";
  if (["countries", "currencies", "payment_providers"].includes(table))
    return "code";
  if (["project_categories", "review_categories"].includes(table))
    return "category";
  return "id";
}
function lookupRecord(row: any) {
  return row?.value !== undefined && typeof row.value === "string"
    ? row.value
    : row?.value !== undefined
      ? JSON.stringify(row.value, null, 2)
      : "";
}
function TableManager({
  table,
  readOnly,
  search,
  filter,
  disableCreate = false,
}: {
  table: string;
  readOnly: boolean;
  search: string;
  filter?: string;
  disableCreate?: boolean;
}) {
  const [state, setState] = useState<any>({ loading: true });
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [lookups, setLookups] = useState<Lookups>({
    courses: [],
    modules: [],
    products: [],
    prices: [],
    support_packages: [],
    countries: [],
    currencies: [],
    review_categories: [],
  });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyUser, setHistoryUser] = useState<any>(null);
  useEffect(() => {
    setPage(0);
  }, [search]);
  const load = useCallback(() => {
    setState((s: any) => ({ ...s, loading: true }));
    getData("admin", {
      table,
      page: String(page),
      ...(search ? { search } : {}),
    })
      .then((r) => setState({ loading: false, ...r, rows: asArray(r.data) }))
      .catch(() =>
        setState({ loading: false, error: "Records could not be loaded." }),
      );
  }, [table, page, search]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    Promise.all(
      [
        "courses",
        "products",
        "product_prices",
        "course_modules",
        "support_packages",
        "countries",
        "currencies",
        "review_categories",
      ].map((t) => getData("admin", { table: t })),
    )
      .then((rs) =>
        setLookups({
          courses: asArray(rs[0].data),
          products: asArray(rs[1].data),
          prices: asArray(rs[2].data),
          modules: asArray(rs[3].data),
          support_packages: asArray(rs[4].data),
          countries: asArray(rs[5].data),
          currencies: asArray(rs[6].data),
          review_categories: asArray(rs[7].data),
        }),
      )
      .catch(() => {});
  }, []);
  let rows = asArray(state.rows);
  if (filter === "notifications")
    rows = rows.filter(
      (r: any) =>
        r.category === "notifications" ||
        String(r.key || "").startsWith("notification."),
    );
  rows = rows.filter(
    (r: any) =>
      !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );
  const defs = fields[table] || [];
  const key = primaryKey(table);
  const cols =
    table === "contact_messages"
      ? ["name", "email", "message", "status", "created_at"]
      : defs.length
        ? defs.slice(0, 5).map((f) => f.key)
        : [key, "user_id", "status", "created_at"];
  function openForm(record: any = null) {
    setEditing(
      record
        ? {
            ...record,
            ...(table === "business_settings"
              ? { value: lookupRecord(record) }
              : {}),
          }
        : {},
    );
    setFormOpen(true);
    setNotice("");
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    const form = new FormData(e.currentTarget);
    const record: Record<string, any> = {};
    if (editing?.[key] != null) record[key] = editing[key];
    for (const field of defs) {
      if (field.key === "key" && editing?.key) {
        record.key = editing.key;
        continue;
      }
      const val = form.get(field.key);
      if (val === null) continue;
      const raw = String(val);
      if (field.type === "lines")
        record[field.key] = raw
          .split(/\r?\n|,/)
          .map((x) => x.trim())
          .filter(Boolean);
      else if (field.type === "boolean") record[field.key] = raw === "true";
      else if (field.type === "number") {
        if (raw === "" && !editing?.[key]) continue;
        const n = Number(raw);
        if (raw !== "" && !Number.isFinite(n)) {
          setNotice(`${field.label} must be a valid number.`);
          setBusy(false);
          return;
        }
        record[field.key] = raw === "" ? null : n;
      } else if (field.type === "major_amount") {
        const currency = String(
          form.get("currency") || editing?.currency || "",
        );
        const c = lookups.currencies.find((x) => x.code === currency);
        const minorUnits = Number(c?.minor_units);
        const major = Number(raw);
        if (
          raw.trim() === "" ||
          !Number.isFinite(major) ||
          !Number.isInteger(minorUnits) ||
          minorUnits < 0 ||
          minorUnits > 4
        ) {
          setNotice("Choose a configured currency and enter a valid amount.");
          setBusy(false);
          return;
        }
        const minor = Math.round(major * 10 ** minorUnits);
        if (
          !Number.isSafeInteger(minor) ||
          minor < 0 ||
          Math.abs(major - minor / 10 ** minorUnits) > 1e-8
        ) {
          setNotice(`Amount has too many decimal places for ${currency}.`);
          setBusy(false);
          return;
        }
        record.amount = minor;
        record.currency = currency;
      } else if (field.type === "datetime") {
        const d = raw ? new Date(raw) : null;
        if (d && Number.isNaN(d.getTime())) {
          setNotice(`${field.label} is not a valid date and time.`);
          setBusy(false);
          return;
        }
        record[field.key] = d ? d.toISOString() : null;
      } else if (field.type === "setting_value") {
        const type = String(
          form.get("type") || editing?.type || "STRING",
        ).toUpperCase();
        if (type === "BOOLEAN") record.value = raw === "true";
        else if (["NUMBER", "DURATION", "PERCENTAGE"].includes(type)) {
          const n = Number(raw);
          if (
            !Number.isFinite(n) ||
            n < 0 ||
            (type === "PERCENTAGE" && n > 100)
          ) {
            setNotice(`${type} setting value is invalid.`);
            setBusy(false);
            return;
          }
          record.value = n;
        } else if (type === "JSON") {
          try {
            record.value = JSON.parse(raw);
          } catch {
            setNotice("Enter valid JSON for this setting.");
            setBusy(false);
            return;
          }
        } else if (type === "CURRENCY" && !/^[A-Z]{3}$/.test(raw)) {
          setNotice("Use a configured three-letter ISO currency code.");
          setBusy(false);
          return;
        } else if (type === "URL" && raw) {
          try {
            if (!["https:", "http:"].includes(new URL(raw).protocol))
              throw new Error();
          } catch {
            setNotice("Enter a valid http(s) URL for this setting.");
            setBusy(false);
            return;
          }
          record.value = raw;
        } else record.value = raw;
      } else
        record[field.key] =
          raw === "" &&
          [
            "product_id",
            "country_code",
            "external_url",
            "storage_path",
            "thumbnail_url",
            "video_url",
            "meeting_url",
            "url",
            "publish_at",
            "starts_at",
            "ends_at",
            "description",
          ].includes(field.key)
            ? null
            : raw;
    }
    if (table === "courses" && record.product_id === "")
      record.product_id = null;
    if (
      table === "course_resources" &&
      !record.storage_path &&
      !record.external_url
    ) {
      setBusy(false);
      setNotice("Add an external URL or upload a protected resource file.");
      return;
    }
    try {
      const result = await postAction("admin_save", { table, record });
      setBusy(false);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setNotice(result.message || "Changes saved.");
      setFormOpen(false);
      setEditing(null);
      load();
    } catch {
      setBusy(false);
      setNotice(
        "The record could not be saved. Check the values and try again.",
      );
    }
  }
  if (state.loading)
    return (
      <p className="loading">Loading {sections[table]?.label || table}…</p>
    );
  if (state.error)
    return (
      <div className="form-alert" role="alert">
        {state.error}
      </div>
    );
  const total = Number(state.count ?? rows.length);
  const pageCount = Math.max(1, Math.ceil(total / 50));
  return (
    <>
      {(table === "payments" || table === "payment_refunds") && (
        <ExistingRefundImport />
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          marginBottom: 15,
          flexWrap: "wrap",
        }}
      >
        <span className="field-hint">
          {total} records · page {page + 1} of {pageCount} ·{" "}
          {readOnly ? "view only" : "database-backed management"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-small" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
          {!readOnly && !disableCreate && defs.length > 0 && (
            <button className="btn btn-small" onClick={() => openForm()}>
              <Plus size={14} /> New record
            </button>
          )}
        </div>
      </div>
      {notice && (
        <div
          className="form-alert form-success"
          role="status"
          style={{ marginBottom: 12 }}
        >
          {notice}
        </div>
      )}
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {cols.map((c: string) => (
                  <th key={c}>{c.replaceAll("_", " ")}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r[key] || r.id || JSON.stringify(r).slice(0, 30)}>
                  {cols.map((c: string) => (
                    <td
                      key={c}
                      style={{
                        maxWidth: 260,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {recordValue(r, c)}
                    </td>
                  ))}
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {table === "review_submissions" && (
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() =>
                            window.location.assign(
                              `/admin/reviews?review=${r.id}`,
                            )
                          }
                        >
                          Open
                        </button>
                      )}
                      {table === "profiles" && (
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => setHistoryUser(r)}
                        >
                          View user history
                        </button>
                      )}
                      {!readOnly && defs.length > 0 && (
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => openForm(r)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="soft-panel">
          <strong>No records in this section yet.</strong>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            Items will appear when configured or created. No sample records are
            being shown.
          </p>
        </div>
      )}
      {pageCount > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
        >
          <button
            className="btn btn-outline btn-small"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft size={15} /> Previous
          </button>
          <span className="field-hint">
            Page {page + 1} of {pageCount}
          </span>
          <button
            className="btn btn-outline btn-small"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}
      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "#0a211cc4",
            overflowY: "auto",
            padding: 22,
            display: "grid",
            placeItems: "center",
          }}
        >
          <form
            className="card"
            onSubmit={save}
            style={{
              width: "min(760px,100%)",
              padding: 24,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <span className="eyebrow">Database record</span>
                <h2
                  id="form-title"
                  className="font-display"
                  style={{ fontSize: 26, margin: "5px 0 18px" }}
                >
                  {editing?.[key] ? "Edit" : "Create"}{" "}
                  {sections[table]?.label || table}
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => setFormOpen(false)}
              >
                Close
              </button>
            </div>
            {table === "product_prices" && (
              <p className="soft-panel" style={{ fontSize: 12 }}>
                Amount input is in major units. The form converts to minor units
                using the selected currency’s configured precision; existing
                price versions remain immutable in the service.
              </p>
            )}
            {table === "lessons" && (
              <p className="soft-panel" style={{ fontSize: 12 }}>
                Lesson content and media are protected course material. Public
                pages expose curriculum titles only.
              </p>
            )}
            {table === "events" && (
              <p className="soft-panel" style={{ fontSize: 12 }}>
                Private meeting links are stored separately from public event
                details and are only for participants/admins. Leave the private
                field blank until a confirmed link is available; no default
                meeting link is assumed.
              </p>
            )}
            <div className="grid-2">
              {defs.map((f) => (
                <div
                  key={f.key}
                  style={
                    f.type === "textarea" ||
                    f.type === "lines" ||
                    f.type === "setting_value"
                      ? { gridColumn: "1/-1" }
                      : undefined
                  }
                >
                  {editing?.[key] && f.key === key ? (
                    <div className="field">
                      <label htmlFor={`readonly-${key}`}>
                        {f.label} (read-only key)
                      </label>
                      <input
                        id={`readonly-${key}`}
                        className="input"
                        value={String(editing[key])}
                        disabled
                      />
                    </div>
                  ) : f.type === "upload" ? (
                    <FieldUpload
                      f={f}
                      value={editing?.[f.key]}
                      record={editing}
                      lookups={lookups}
                      onChange={(v) =>
                        setEditing((prev: any) => ({
                          ...(prev || {}),
                          [f.key]: v,
                        }))
                      }
                    />
                  ) : (
                    <FieldInput
                      f={f}
                      value={
                        f.type === "major_amount" && editing?.amount != null
                          ? lookups.currencies.find(
                              (c) => c.code === editing.currency,
                            )
                            ? Number(editing.amount) /
                              10 **
                                Number(
                                  lookups.currencies.find(
                                    (c) => c.code === editing.currency,
                                  )?.minor_units,
                                )
                            : ""
                          : editing?.[f.key]
                      }
                      lookups={lookups}
                      settingType={editing?.type}
                      onChange={(v) =>
                        setEditing((prev: any) => ({
                          ...(prev || {}),
                          [f.key]: v,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>
            {notice && (
              <div
                className="form-alert"
                role="alert"
                style={{ marginTop: 14 }}
              >
                {notice}
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "end",
                gap: 9,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save record"}
              </button>
            </div>
          </form>
        </div>
      )}
      {historyUser && (
        <UserHistory user={historyUser} onClose={() => setHistoryUser(null)} />
      )}
    </>
  );
}

const userHistoryResources = [
  {
    table: "enrollments",
    label: "Enrollments",
    columns: ["course_id", "current_lesson_id", "enrolled_at", "completed_at"],
  },
  {
    table: "orders",
    label: "Orders",
    columns: ["product_id", "status", "amount", "currency", "created_at"],
  },
  {
    table: "subscriptions",
    label: "Subscriptions",
    columns: ["plan_id", "status", "period_start", "period_end", "created_at"],
  },
  {
    table: "review_submissions",
    label: "Review submissions",
    columns: [
      "title",
      "review_category",
      "status",
      "created_at",
      "completed_at",
    ],
  },
  {
    table: "appointments",
    label: "Appointments",
    columns: ["starts_at", "ends_at", "status", "package_id"],
  },
  {
    table: "points_transactions",
    label: "Points transactions",
    columns: ["event_key", "event_id", "points", "created_at"],
  },
];
function UserHistory({ user, onClose }: { user: any; onClose: () => void }) {
  const [state, setState] = useState<any>({ loading: true, groups: [] });
  useEffect(() => {
    let active = true;
    Promise.all(
      userHistoryResources.map(async (resource) => ({
        resource,
        result: await getData("admin", {
          table: resource.table,
          user_id: String(user.id),
          page: "0",
        }),
      })),
    )
      .then((results) => {
        if (active)
          setState({
            loading: false,
            groups: results.map(({ resource, result }) => ({
              ...resource,
              rows: asArray(result.data),
              error: result.error,
            })),
          });
      })
      .catch(() => {
        if (active)
          setState({
            loading: false,
            error: "User history could not be loaded.",
          });
      });
    return () => {
      active = false;
    };
  }, [user.id]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        background: "#0a211cc4",
        overflowY: "auto",
        padding: 20,
        display: "grid",
        placeItems: "center",
      }}
    >
      <section
        className="card"
        style={{
          width: "min(1050px,100%)",
          padding: 24,
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <span className="eyebrow">Profile history</span>
            <h2
              id="history-title"
              className="font-display"
              style={{ fontSize: 26, margin: "5px 0 16px" }}
            >
              {text(user.name, user.email || user.id)}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {user.email && (
          <p className="field-hint">
            {user.email} · {user.id}
          </p>
        )}
        <ManualCourseGrant userId={String(user.id)} />
        {state.loading ? (
          <p className="loading">Loading user history…</p>
        ) : state.error ? (
          <div className="form-alert" role="alert">
            {state.error}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {state.groups.map((group: any) => (
              <section key={group.table}>
                <h3
                  className="font-display"
                  style={{ fontSize: 19, margin: "0 0 8px" }}
                >
                  {group.label}{" "}
                  <small className="field-hint">({group.rows.length})</small>
                </h3>
                {group.error ? (
                  <div className="form-alert" role="alert">
                    {group.error}
                  </div>
                ) : group.rows.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {group.columns.map((column: string) => (
                            <th key={column}>{column.replaceAll("_", " ")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row: any) => (
                          <tr key={row.id}>
                            {group.columns.map((column: string) => (
                              <td
                                key={column}
                                style={{
                                  maxWidth: 260,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {recordValue(row, column)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    No {group.label.toLowerCase()} records returned for this
                    user.
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewQueue({ search }: { search: string }) {
  const [state, setState] = useState<any>({ loading: true });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [feedback, setFeedback] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  const [me, setMe] = useState<any>(null);
  useEffect(() => {
    setPage(0);
  }, [search]);
  const load = useCallback(() => {
    setState((s: any) => ({ ...s, loading: true }));
    Promise.all([
      getData("admin", {
        table: "review_submissions",
        page: String(page),
        ...(search ? { search } : {}),
      }),
      getData("review_configuration"),
    ])
      .then(([r, c]) =>
        setState({
          loading: false,
          rows: asArray(r.data),
          count: r.count,
          configured: r.configured !== false && c.configured !== false,
          config: c.data || {},
        }),
      )
      .catch(() =>
        setState({
          loading: false,
          error: "Review queue and scoring settings could not be loaded.",
        }),
      );
  }, [page, search]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    getData("me")
      .then((r) => setMe(r.data))
      .catch(() => setMe(null));
  }, []);
  const criteria = asArray(state.config?.scoring_criteria);
  const settings = asArray(state.config?.settings);
  const maxSetting = settings.find((s: any) => s.key === "review.scoring_max");
  const overallMax = Number(maxSetting?.value);
  const maxQueuePage = Math.max(
    0,
    Math.ceil(Number(state.count || 0) / 50) - 1,
  );
  async function choose(row: any) {
    setSelected(row);
    setFeedback("");
    setDetail(null);
    const r = await getData("review_detail", { id: row.id });
    if (r.error) setFeedback(r.error);
    else setDetail(r.data);
  }
  async function setStatus(status: string) {
    if (!selected) return;
    const r = await postAction("review_status", {
      id: selected.id,
      status,
      reviewer_id: status === "UNDER_REVIEW" ? me?.user?.id || null : null,
    });
    setFeedback(r.ok ? r.message || `Status changed to ${status}.` : r.error);
    if (r.ok) load();
  }
  async function sendFeedback(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const form = new FormData(e.currentTarget);
    const categoryScores: Record<string, number> = {};
    for (const criterion of criteria.filter(
      (c: any) => c.category === selected.review_category,
    )) {
      const value = Number(form.get(`score_${criterion.criterion_key}`));
      if (!Number.isFinite(value)) {
        setFeedback(`Enter a score for ${criterion.label}.`);
        return;
      }
      categoryScores[criterion.criterion_key] = value;
    }
    const payload = {
      submission_id: selected.id,
      overall_score: Number(form.get("overall_score")),
      category_scores: categoryScores,
      strengths: form.get("strengths"),
      improvements: form.get("improvements"),
      next_steps: form.get("next_steps"),
    };
    const r = await postAction("review_feedback", payload);
    setFeedback(
      r.ok ? r.message || "Feedback submitted and review completed." : r.error,
    );
    if (r.ok) {
      setSelected(null);
      setDetail(null);
      load();
    }
  }
  if (state.loading) return <p className="loading">Loading review queue…</p>;
  if (state.error) return <div className="form-alert">{state.error}</div>;
  let rows = asArray(state.rows).filter(
    (r: any) =>
      !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );
  const rowCount = Number(state.count || 0);
  const selectedCriteria = criteria.filter(
    (c: any) => c.category === selected?.review_category,
  );
  const canScore =
    Number.isFinite(overallMax) &&
    overallMax > 0 &&
    selectedCriteria.length > 0;
  return (
    <>
      <div className="soft-panel" style={{ marginBottom: 16, fontSize: 13 }}>
        Review status is changed through the validated workflow. A review
        becomes complete only when category scores and structured feedback are
        submitted.
      </div>
      {rows.length ? (
        <>
          <div className="grid-2" style={{ alignItems: "start" }}>
            <div className="card" style={{ padding: 8 }}>
              {rows.map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => choose(r)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 13,
                    width: "100%",
                    textAlign: "left",
                    background:
                      selected?.id === r.id ? "#edf2e8" : "transparent",
                    border: 0,
                    borderRadius: 10,
                  }}
                >
                  <span className="badge">{text(r.status, "PENDING")}</span>
                  <span style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13 }}>
                      {text(r.title, "Project submission")}
                    </strong>
                    <small className="field-hint" style={{ display: "block" }}>
                      {formatDate(r.created_at)} ·{" "}
                      {text(
                        r.review_category_label || r.review_category,
                        r.project_category_label ||
                          r.project_category ||
                          "General",
                      )}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
            <section className="card" style={{ padding: 22 }}>
              {!selected ? (
                <p className="muted">Choose a submission to review.</p>
              ) : (
                <>
                  <span className="eyebrow">Review submission</span>
                  <h2
                    className="font-display"
                    style={{ fontSize: 23, margin: "8px 0" }}
                  >
                    {selected.title}
                  </h2>
                  <p className="field-hint">{text(selected.description, "")}</p>
                  {detail?.video_url && (
                    <video
                      controls
                      playsInline
                      src={detail.video_url}
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        margin: "12px 0",
                      }}
                    />
                  )}
                  {selected.question && (
                    <div
                      className="soft-panel"
                      style={{ fontSize: 13, margin: "12px 0" }}
                    >
                      <strong>Student question</strong>
                      <p>{selected.question}</p>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      margin: "12px 0",
                    }}
                  >
                    {selected.status === "PENDING" && (
                      <button
                        className="btn btn-outline btn-small"
                        onClick={() => setStatus("UNDER_REVIEW")}
                      >
                        Mark under review
                      </button>
                    )}
                    {selected.status === "UNDER_REVIEW" && (
                      <span className="badge badge-yellow">
                        Assigned review in progress
                      </span>
                    )}
                  </div>
                  <form
                    onSubmit={sendFeedback}
                    style={{
                      display: "grid",
                      gap: 12,
                      borderTop: "1px solid var(--line)",
                      paddingTop: 15,
                    }}
                  >
                    <h3
                      className="font-display"
                      style={{ fontSize: 19, margin: 0 }}
                    >
                      Structured feedback
                    </h3>
                    {canScore ? (
                      <>
                        <div className="field">
                          <label htmlFor="overall_score">
                            Overall score (0–{overallMax})
                          </label>
                          <input
                            className="input"
                            id="overall_score"
                            name="overall_score"
                            type="number"
                            min="0"
                            max={overallMax}
                            step="any"
                            required
                          />
                        </div>
                        <div>
                          <strong style={{ fontSize: 13 }}>
                            Scores for{" "}
                            {text(
                              selected.review_category_label ||
                                selected.review_category,
                              "this review category",
                            )}
                          </strong>
                          {selectedCriteria.map((c: any) => (
                            <div
                              className="field"
                              key={c.criterion_key}
                              style={{ marginTop: 8 }}
                            >
                              <label htmlFor={`score_${c.criterion_key}`}>
                                {c.label} (0–{c.max_score})
                              </label>
                              <input
                                className="input"
                                id={`score_${c.criterion_key}`}
                                name={`score_${c.criterion_key}`}
                                type="number"
                                min="0"
                                max={c.max_score}
                                step="any"
                                required
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <Notice type="error">
                        This review cannot be scored until its category criteria
                        and configured overall score maximum are available.
                      </Notice>
                    )}
                    {[
                      ["strengths", "What worked well"],
                      ["improvements", "What could improve"],
                      ["next_steps", "Suggested next steps"],
                    ].map(([name, label]) => (
                      <div className="field" key={name}>
                        <label htmlFor={name}>{label}</label>
                        <textarea
                          className="textarea"
                          id={name}
                          name={name}
                          required
                          minLength={1}
                        />
                      </div>
                    ))}
                    <button className="btn" disabled={!canScore}>
                      Send feedback & complete review
                    </button>
                  </form>
                  {feedback && (
                    <div
                      className={
                        feedback.toLowerCase().includes("could not") ||
                        feedback.toLowerCase().includes("invalid")
                          ? "form-alert"
                          : "soft-panel"
                      }
                      role="status"
                      style={{ marginTop: 12 }}
                    >
                      {feedback}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
            }}
          >
            <button
              className="btn btn-outline btn-small"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span className="field-hint">
              {rowCount} submissions · page {page + 1} of{" "}
              {Math.max(1, maxQueuePage + 1)}
            </span>
            <button
              className="btn btn-outline btn-small"
              disabled={page >= maxQueuePage}
              onClick={() => setPage((p) => Math.min(maxQueuePage, p + 1))}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </>
      ) : (
        <div className="soft-panel">
          <strong>No reviews are waiting.</strong>
          <p className="muted" style={{ margin: 0 }}>
            New submissions will appear when learners send work for feedback.
          </p>
        </div>
      )}
    </>
  );
}

function CreditManager({ search }: { search: string }) {
  const [state, setState] = useState<any>({ loading: true });
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<any>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setPage(0);
  }, [search]);
  const load = useCallback(
    () =>
      getData("admin", {
        table: "profiles",
        page: String(page),
        ...(search ? { search } : {}),
      })
        .then((r) =>
          setState({ loading: false, rows: asArray(r.data), count: r.count }),
        )
        .catch(() =>
          setState({
            loading: false,
            error: "Learner accounts could not be loaded.",
          }),
        ),
    [page, search],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function grant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await postAction("admin_credit", {
      user_id: target.id,
      quantity: Number(f.get("quantity")),
      reason: f.get("reason"),
    });
    setMessage(r.ok ? r.message || "Credit adjustment recorded." : r.error);
    if (r.ok) {
      setTarget(null);
      load();
    }
  }
  if (state.loading)
    return <p className="loading">Loading learner accounts…</p>;
  if (state.error) return <div className="form-alert">{state.error}</div>;
  const rows = asArray(state.rows).filter(
    (u: any) =>
      !search ||
      `${u.name} ${u.email} ${u.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const count = Number(state.count || 0);
  const lastPage = Math.max(0, Math.ceil(count / 50) - 1);
  return (
    <>
      <div className="soft-panel" style={{ marginBottom: 15, fontSize: 13 }}>
        Manual grants are separate, reasoned, and audited. Granting reviews does
        not change payment or order records.
      </div>
      {message && (
        <div className="form-alert form-success" style={{ marginBottom: 12 }}>
          {message}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Learner</th>
              <th>Country</th>
              <th>Account status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u: any) => (
              <tr key={u.id}>
                <td>
                  {text(u.name, u.email || u.id)}
                  {u.email && (
                    <small className="field-hint" style={{ display: "block" }}>
                      {u.email}
                    </small>
                  )}
                </td>
                <td>{text(u.country_code, "—")}</td>
                <td>{text(u.status, "ACTIVE")}</td>
                <td>
                  <button
                    className="btn btn-outline btn-small"
                    onClick={() => setTarget(u)}
                  >
                    Grant review credit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
        }}
      >
        <button
          className="btn btn-outline btn-small"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <span className="field-hint">
          {count} people · page {page + 1} of {lastPage + 1}
        </span>
        <button
          className="btn btn-outline btn-small"
          disabled={page >= lastPage}
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
      {target && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "#0a211cc4",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <form
            className="card"
            style={{ padding: 24, width: "min(460px,100%)" }}
            onSubmit={grant}
          >
            <h2 className="font-display" style={{ fontSize: 24 }}>
              Manual review credit
            </h2>
            <p className="muted">
              For {text(target.name, target.email || target.id)}. This action is
              recorded in the audit trail.
            </p>
            <div className="field">
              <label htmlFor="quantity">Quantity</label>
              <input
                className="input"
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                max="100"
                defaultValue="1"
                required
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="reason">Reason</label>
              <textarea
                className="textarea"
                id="reason"
                name="reason"
                minLength={5}
                required
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "end",
                gap: 9,
                marginTop: 15,
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setTarget(null)}
              >
                Cancel
              </button>
              <button className="btn">Record credit grant</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
