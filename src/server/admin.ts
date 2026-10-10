import "server-only";
import { revalidatePath } from "next/cache";
import { checked } from "./http";
const fields: Record<string, string[]> = {
  profiles: ["name", "country_code", "status"],
  courses: [
    "title",
    "slug",
    "description",
    "thumbnail_url",
    "instructor",
    "category",
    "level",
    "access_type",
    "status",
    "featured",
    "estimated_minutes",
    "objectives",
    "prerequisites",
    "product_id",
  ],
  course_modules: ["course_id", "title", "sort_order"],
  lessons: [
    "module_id",
    "title",
    "body",
    "video_url",
    "resources",
    "exercise",
    "prompt",
    "sort_order",
  ],
  course_resources: [
    "course_id",
    "lesson_id",
    "title",
    "external_url",
    "storage_path",
    "resource_type",
    "sort_order",
  ],
  products: ["name", "type", "status", "review_credit_quantity"],
  product_prices: [
    "product_id",
    "amount",
    "currency",
    "country_code",
    "billing_interval",
    "billing_interval_count",
    "status",
    "starts_at",
    "ends_at",
    "sort_order",
  ],
  membership_plans: [
    "name",
    "description",
    "product_id",
    "price_id",
    "included_reviews",
    "billing_months",
    "status",
    "benefits",
    "countries",
    "providers",
  ],
  support_packages: [
    "name",
    "description",
    "product_id",
    "price_id",
    "duration_minutes",
    "status",
  ],
  availability: [
    "package_id",
    "starts_at",
    "ends_at",
    "capacity",
    "meeting_url",
    "status",
  ],
  ai_drops: [
    "title",
    "description",
    "type",
    "url",
    "thumbnail_url",
    "audience",
    "status",
    "publish_at",
    "resource_path",
  ],
  events: [
    "title",
    "description",
    "starts_at",
    "ends_at",
    "audience",
    "status",
    "publish_at",
    "url",
    "thumbnail_url",
    "meeting_url",
    "recording_url",
    "resources",
  ],
  announcements: [
    "title",
    "description",
    "audience",
    "status",
    "publish_at",
    "url",
  ],
  business_settings: [
    "key",
    "value",
    "type",
    "category",
    "description",
    "active",
    "is_public",
    "unit",
    "min_value",
    "max_value",
    "allowed_values",
  ],
  countries: ["code", "name", "currency_code", "active"],
  currencies: ["code", "name", "minor_units"],
  payment_providers: [
    "code",
    "name",
    "enabled",
    "countries",
    "currencies",
    "methods",
    "recurring_enabled",
    "mode",
    "capabilities",
  ],
  project_categories: ["category", "label", "active", "sort_order"],
  review_categories: ["category", "label", "active", "sort_order"],
  review_scoring_criteria: [
    "category",
    "criterion_key",
    "label",
    "description",
    "max_score",
    "active",
    "sort_order",
  ],
  points_rules: ["event_key", "name", "points", "active"],
  badges: ["key", "name", "description", "icon_url", "active"],
  contact_messages: ["status"],
  appointments: ["status", "starts_at", "ends_at", "meeting_url"],
};
function primaryKey(table: string) {
  return table === "business_settings"
    ? "key"
    : ["countries", "currencies", "payment_providers"].includes(table)
      ? "code"
      : ["review_categories", "project_categories"].includes(table)
        ? "category"
        : "id";
}
export async function saveAdmin(db: any, payload: any) {
  const table = String(payload.table || "");
  if (!fields[table] || !payload.record || typeof payload.record !== "object")
    throw new Error("This management form is unavailable.");
  const record = payload.record,
    key = primaryKey(table),
    id = record[key];
  if (Object.keys(record).some((k) => k !== key && !fields[table].includes(k)))
    throw new Error(
      "This form contains unsupported fields. Refresh and try again.",
    );
  const values: any = Object.fromEntries(
    Object.entries(record).filter(([name]) => fields[table].includes(name)),
  );
  const nullable = [
    "product_id",
    "price_id",
    "country_code",
    "lesson_id",
    "starts_at",
    "ends_at",
    "publish_at",
    "thumbnail_url",
    "video_url",
    "url",
    "recording_url",
    "resource_path",
    "storage_path",
    "external_url",
    "meeting_url",
    "min_value",
    "max_value",
    "allowed_values",
  ];
  for (const k of nullable) if (values[k] === "") values[k] = null;
  for (const [k, v] of Object.entries(values))
    if (
      (k.endsWith("_url") || k === "url") &&
      v &&
      typeof v === "string" &&
      !v.startsWith("course-assets/")
    ) {
      try {
        if (new URL(v).protocol !== "https:") throw 0;
      } catch {
        throw new Error("Use a secure HTTPS URL for external links.");
      }
    }
  if (table === "business_settings") validateSetting(values);
  if (
    table === "product_prices" &&
    (!Number.isSafeInteger(values.amount) || values.amount < 0)
  )
    throw new Error(
      "Enter a valid price in the currency’s supported precision.",
    );
  if (table === "payment_providers" && values.recurring_enabled)
    throw new Error(
      "Automatic recurring billing is not available yet. Keep manual renewal enabled until the provider lifecycle is tested.",
    );
  const meeting = values.meeting_url;
  if (table === "events") delete values.meeting_url;
  let result: any;
  if (table === "product_prices" && id) {
    const newId = checked(
      await db.rpc("admin_version_price", { p_price_id: id, p_values: values }),
    );
    result = checked(await db.from(table).select("*").eq("id", newId).single());
  } else if (id) {
    const exists = checked(
      await db.from(table).select(key).eq(key, id).maybeSingle(),
    );
    result = exists
      ? checked(
          await db.from(table).update(values).eq(key, id).select("*").single(),
        )
      : checked(
          await db
            .from(table)
            .insert({ ...values, ...(key === "id" ? {} : { [key]: id }) })
            .select("*")
            .single(),
        );
  } else
    result = checked(await db.from(table).insert(values).select("*").single());
  if (table === "events" && meeting)
    checked(
      await db
        .from("event_private_links")
        .upsert({ event_id: result.id, meeting_url: meeting })
        .select("event_id")
        .single(),
    );
  if (table === "events" && meeting === null)
    checked(
      await db.from("event_private_links").delete().eq("event_id", result.id),
    );
  revalidatePath("/", "layout");
  return result;
}
export async function archiveAdmin(db: any, table: string, id: string) {
  if (!fields[table]) throw new Error("This record cannot be archived here.");
  let values: any;
  if (
    [
      "courses",
      "products",
      "product_prices",
      "membership_plans",
      "support_packages",
    ].includes(table)
  )
    values = { status: "ARCHIVED" };
  else if (["ai_drops", "events", "announcements"].includes(table))
    values = { status: "CANCELLED" };
  else if (table === "availability") values = { status: "CLOSED" };
  else if (table === "payment_providers") values = { enabled: false };
  else if (
    [
      "countries",
      "business_settings",
      "project_categories",
      "review_categories",
      "review_scoring_criteria",
      "points_rules",
      "badges",
    ].includes(table)
  )
    values = { active: false };
  else
    throw new Error(
      "This record does not support archiving. Edit its supported fields instead.",
    );
  const result = checked(
    await db
      .from(table)
      .update(values)
      .eq(primaryKey(table), id)
      .select("*")
      .single(),
  );
  revalidatePath("/", "layout");
  return result;
}
function validateSetting(record: any) {
  if (!record.type || !record.key)
    throw new Error("A setting key and value type are required.");
  const value = record.value;
  if (
    ["NUMBER", "DURATION", "PERCENTAGE"].includes(record.type) &&
    (!Number.isFinite(value) || value < 0)
  )
    throw new Error("Enter a valid non-negative number.");
  if (record.type === "BOOLEAN" && typeof value !== "boolean")
    throw new Error("Choose a boolean value for this setting.");
  if (record.type === "CURRENCY" && !/^[A-Z]{3}$/.test(value))
    throw new Error("Enter a three-letter ISO currency code.");
  if (
    record.key === "community.whatsapp_url" &&
    (record.is_public || record.category === "public")
  )
    throw new Error(
      "The community WhatsApp link must remain private to eligible members.",
    );
  if (
    [
      "review.video_max_duration_seconds",
      "review.video_max_size_bytes",
    ].includes(record.key) &&
    (!Number.isInteger(value) || value < 1)
  )
    throw new Error("Upload limits must be positive whole numbers.");
}
