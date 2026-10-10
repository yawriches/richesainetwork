import "server-only";
import { checked } from "./http";
export async function recommendCourses(
  db: any,
  service: any | null,
  profile: any,
) {
  // Personalized mappings are an optional admin-only setting. If the
  // privileged client is not configured, keep the dashboard useful by using
  // the published-course fallback below instead of failing the whole request.
  const setting = service
    ? checked(
        await service
          .from("business_settings")
          .select("value")
          .eq("key", "learning.recommendation_mappings")
          .eq("active", true)
          .maybeSingle(),
      )
    : null;
  const mappings = Array.isArray(setting?.value) ? setting.value : [];
  const ids = mappings
    .filter(
      (m: any) =>
        m &&
        (!m.interest || profile.interests?.includes(m.interest)) &&
        (!m.experience_level ||
          m.experience_level === profile.experience_level) &&
        /^[0-9a-f-]{36}$/i.test(m.course_id || ""),
    )
    .map((m: any) => m.course_id)
    .slice(0, 20);
  if (ids.length) {
    const rows = checked(
      await db
        .from("courses")
        .select("id,title,slug,category,level,access_type")
        .in("id", ids)
        .eq("status", "PUBLISHED")
        .eq("access_type", "FREE")
        .limit(3),
    );
    if (rows.length) return rows;
  }
  const rows = checked(
    await db
      .from("courses")
      .select("id,title,slug,category,level,access_type")
      .eq("status", "PUBLISHED")
      .eq("access_type", "FREE")
      .eq("level", profile.experience_level || "BEGINNER")
      .order("featured", { ascending: false })
      .limit(3),
  );
  return rows;
}
