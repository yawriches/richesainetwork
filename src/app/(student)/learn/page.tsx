import type { Metadata } from "next";
import { StudentView } from "@/components/portal";
export const metadata: Metadata = { title: "My learning" };
export default function Page() {
  return <StudentView page="learn" />;
}
