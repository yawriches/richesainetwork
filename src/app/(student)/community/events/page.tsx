import type { Metadata } from "next";
import { StudentView } from "@/components/portal";
export const metadata: Metadata = { title: "Community events" };
export default function Page() {
  return <StudentView page="events" />;
}
