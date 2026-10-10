import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPublic } from "@/lib/catalog";
import { CourseDetail } from "@/components/course-detail";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await readPublic("courses", { slug });
  const course = result.data[0];
  return {
    title: course?.title || "Course details",
    description: course?.description || "Explore a published learning course.",
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const result = await readPublic("courses", { slug });
  if (
    result.configured &&
    !result.error &&
    (!result.data || result.data.length === 0)
  )
    notFound();

  const course = result.data?.[0];
  if (!course) {
    const details =
      result.error ||
      (result.configured
        ? "The course catalogue returned no course details."
        : "The learning catalogue is connecting. Please try again shortly.");
    return (
      <main className="section">
        <div className="wrap">
          <h1 className="display">
            Course details are temporarily unavailable.
          </h1>
          <p className="muted">{details}</p>
        </div>
      </main>
    );
  }

  const curriculum = await readPublic("curriculum", { course_id: course.id });
  return (
    <CourseDetail
      course={course}
      curriculum={curriculum.data}
      configured={curriculum.configured}
      error={curriculum.error}
    />
  );
}
