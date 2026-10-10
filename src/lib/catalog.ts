import "server-only";
import { configured, publicClient } from "./supabase/server";
export type CatalogResult = {
  data: any[];
  configured: boolean;
  count?: number | null;
  error?: string;
};
const publicSelections: Record<string, string> = {
  courses:
    "id,title,slug,description,thumbnail_url,instructor,category,level,access_type,status,featured,estimated_minutes,objectives,prerequisites,product_id,created_at",
  products: "id,name,type,status,review_credit_quantity",
  membership_plans:
    "id,name,description,product_id,price_id,included_reviews,billing_months,status,benefits,countries,providers,product_prices(id,amount,currency,status,billing_interval,billing_interval_count,currencies(minor_units))",
  countries: "code,name,currency_code,active",
  product_prices:
    "id,product_id,amount,currency,country_code,billing_interval,billing_interval_count,status,starts_at,ends_at,sort_order",
  support_packages:
    "id,name,description,product_id,price_id,duration_minutes,status,product_prices(amount,currency,currencies(minor_units))",
  ai_drops:
    "id,title,description,type,url,thumbnail_url,audience,status,publish_at",
  announcements: "id,title,description,audience,status,publish_at",
  currencies: "code,name,minor_units",
};
export async function readPublic(
  resource: string,
  filters: Record<string, string> = {},
): Promise<CatalogResult> {
  if (!configured())
    return {
      data: [],
      configured: false,
      error: "The platform connection is being prepared.",
    };
  try {
    const db = publicClient();
    if (resource === "settings") {
      const { data, error } = await db
        .from("business_settings")
        .select("key,value,type,category,description,active,unit")
        .eq("active", true)
        .eq("is_public", true)
        .limit(100);
      if (error) throw error;
      return { data: data || [], configured: true };
    }
    if (resource === "community_enabled") {
      const { data, error } = await db.rpc("community_is_enabled");
      if (error) throw error;
      return { data: [{ enabled: data !== false }], configured: true };
    }
    if (resource === "ai_support_status") {
      const { data, error } = await db.rpc("ai_support_public_status");
      if (error) throw error;
      return { data: data || [], configured: true };
    }
    if (resource === "events") {
      const { data, error } = await db
        .from("public_events")
        .select("*")
        .limit(30);
      if (error) throw error;
      return { data: data || [], configured: true };
    }
    if (resource === "availability") {
      let query = db.from("public_availability").select("*");
      if (filters.package_id)
        query = query.eq("package_id", filters.package_id);
      const { data, error } = await query
        .gte("starts_at", new Date().toISOString())
        .limit(50);
      if (error) throw error;
      return { data: data || [], configured: true };
    }
    if (resource === "curriculum") {
      if (!filters.course_id) return { data: [], configured: true };
      const { data, error } = await db
        .from("public_curriculum")
        .select("*")
        .eq("course_id", filters.course_id)
        .order("module_sort_order")
        .order("lesson_sort_order")
        .limit(200);
      if (error) throw error;
      return { data: data || [], configured: true };
    }
    if (!(resource in publicSelections))
      return {
        data: [],
        configured: true,
        error: "This resource is not available.",
      };
    let query = db
      .from(resource)
      .select(publicSelections[resource], { count: "exact" });
    if (resource === "countries") query = query.eq("active", true);
    if (["courses"].includes(resource)) query = query.eq("status", "PUBLISHED");
    if (
      [
        "products",
        "membership_plans",
        "support_packages",
        "product_prices",
      ].includes(resource)
    )
      query = query.eq("status", "ACTIVE");
    if (["ai_drops", "announcements"].includes(resource))
      query = query
        .eq("status", "PUBLISHED")
        .eq("audience", "PUBLIC")
        .lte("publish_at", new Date().toISOString());
    if (filters.slug) query = query.eq("slug", filters.slug);
    if (filters.id) query = query.eq("id", filters.id);
    if (filters.type && resource === "products")
      query = query.eq("type", filters.type);
    if (filters.product_id) query = query.eq("product_id", filters.product_id);
    if (filters.search && resource === "courses")
      query = query.ilike("title", `%${filters.search.replace(/[%_]/g, "")}%`);
    if (filters.access && resource === "courses")
      query = query.eq("access_type", filters.access);
    if (filters.category && resource === "courses")
      query = query.eq("category", filters.category);
    if (filters.level && resource === "courses")
      query = query.eq("level", filters.level);
    const page = Math.max(0, Math.min(1000, Number(filters.page || 0) || 0));
    const sortKey = ["countries", "currencies"].includes(resource)
      ? "code"
      : "id";
    const { data, error, count } = await query
      .order(sortKey)
      .range(page * 24, page * 24 + 23);
    if (error) throw error;
    const rows = ["membership_plans", "support_packages"].includes(resource)
      ? (data || []).map((item: any) => ({
          ...item,
          price: item.product_prices?.amount,
          currency: item.product_prices?.currency,
          minor_units: item.product_prices?.currencies?.minor_units,
        }))
      : data || [];
    return { data: rows, configured: true, count };
  } catch (error) {
    console.error(
      "catalog_query_failed",
      resource,
      (error as { code?: string }).code || "unknown",
    );
    return {
      data: [],
      configured: true,
      error: "Content is being prepared. Please check back shortly.",
    };
  }
}
