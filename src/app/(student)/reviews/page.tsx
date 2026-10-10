import type { Metadata } from "next";
import { StudentView } from "@/components/portal";
export const metadata: Metadata = { title: "Practice reviews" };
export default function Page() {
  return <StudentView page="reviews" />;
}
