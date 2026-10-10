import "server-only";
import { checked } from "./http";
export async function enrollmentList(db: any, userId: string) {
  const enrolled = checked(
    await db
      .from("enrollments")
      .select(
        "*,courses(id,title,slug,category,thumbnail_url,estimated_minutes)",
      )
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false })
      .limit(100),
  );
  if (!enrolled.length) return [];
  const curriculum = checked(
    await db
      .from("public_curriculum")
      .select("course_id,lesson_id")
      .in(
        "course_id",
        enrolled.map((e: any) => e.course_id),
      )
      .limit(10000),
  );
  const progress = checked(
    await db
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .limit(10000),
  );
  const completed = new Set(progress.map((p: any) => p.lesson_id));
  return enrolled.map((e: any) => {
    const lessons = curriculum.filter((l: any) => l.course_id === e.course_id),
      count = lessons.filter((l: any) => completed.has(l.lesson_id)).length;
    return {
      ...e,
      course: e.courses,
      progress_percent: lessons.length
        ? Math.round((count / lessons.length) * 100)
        : 0,
      completed_lessons: count,
      total_lessons: lessons.length,
    };
  });
}
export async function signCourseMedia(db: any, value: unknown, ttl: number) {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("course-assets/"))
    return checked(
      await db.storage
        .from("course-assets")
        .createSignedUrl(value.slice("course-assets/".length), ttl),
    ).signedUrl;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
export async function courseContent(
  db: any,
  userId: string,
  courseId: string,
  ttl: number,
  isAdmin = false,
) {
  const access = checked(
    await db.rpc("can_access_course", {
      p_user_id: userId,
      p_course_id: courseId,
    }),
  );
  if (!access && !isAdmin)
    throw new Error(
      "You do not have access to this course yet. Enroll, purchase it, or check your membership.",
    );
  const course = checked(
    await db
      .from("courses")
      .select("id,title,access_type")
      .eq("id", courseId)
      .single(),
  );
  const modules = checked(
    await db
      .from("course_modules")
      .select("id,title,sort_order")
      .eq("course_id", courseId)
      .order("sort_order")
      .limit(100),
  );
  const raw = modules.length
    ? checked(
        await db
          .from("lessons")
          .select("*")
          .in(
            "module_id",
            modules.map((m: any) => m.id),
          )
          .limit(1000),
      )
    : [];
  raw.sort(
    (a: any, b: any) =>
      (modules.find((m: any) => m.id === a.module_id)?.sort_order ?? 0) -
        (modules.find((m: any) => m.id === b.module_id)?.sort_order ?? 0) ||
      a.sort_order - b.sort_order,
  );
  const progress = raw.length
    ? checked(
        await db
          .from("lesson_progress")
          .select("lesson_id,completed_at")
          .eq("user_id", userId)
          .in(
            "lesson_id",
            raw.map((l: any) => l.id),
          )
          .limit(1000),
      )
    : [];
  const resources = checked(
    await db
      .from("course_resources")
      .select(
        "id,lesson_id,title,external_url,storage_path,resource_type,sort_order",
      )
      .eq("course_id", courseId)
      .order("sort_order")
      .limit(200),
  );
  const resolved = await Promise.all(
    resources.map(async (r: any) => ({
      ...r,
      url: r.storage_path
        ? await signCourseMedia(
            db,
            r.storage_path.startsWith("course-assets/")
              ? r.storage_path
              : `course-assets/${r.storage_path}`,
            ttl,
          )
        : r.external_url,
    })),
  );
  const lessons = await Promise.all(
    raw.map(async (l: any) => ({
      ...l,
      module_title: modules.find((m: any) => m.id === l.module_id)?.title,
      completed_at: progress.find((p: any) => p.lesson_id === l.id)
        ?.completed_at,
      video_url: await signCourseMedia(db, l.video_url, ttl),
      resources: [
        ...(Array.isArray(l.resources) ? l.resources : []),
        ...resolved.filter((r: any) => !r.lesson_id || r.lesson_id === l.id),
      ],
    })),
  );
  const enrollment = checked(
    await db
      .from("enrollments")
      .select("current_lesson_id,completed_at")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle(),
  );
  return {
    lessons,
    course,
    progress: {
      current_lesson_id: enrollment?.current_lesson_id || null,
      completed_at: enrollment?.completed_at || null,
      completed_lesson_ids: progress.map((p: any) => p.lesson_id),
    },
  };
}
