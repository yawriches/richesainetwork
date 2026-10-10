import type { Metadata } from "next";
import { StudentView } from "@/components/portal";
export const metadata: Metadata = { title: "Submit your work" };
export default function Page() {
  return <StudentView page="new-review" />;
}
