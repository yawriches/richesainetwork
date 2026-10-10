import type { Metadata } from "next";
import { StudentView } from "@/components/portal";
export const metadata: Metadata = { title: "Course player" };
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <StudentView page="course" courseId={courseId} />;
}
