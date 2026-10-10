import type { Metadata } from "next";
import { StudentView } from "@/components/portal";
export const metadata: Metadata = { title: "AI drops" };
export default function Page() {
  return <StudentView page="drops" />;
}
