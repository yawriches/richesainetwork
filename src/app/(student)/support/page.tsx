import type { Metadata } from "next";
import { StudentView } from "@/components/portal";
export const metadata: Metadata = { title: "Expert support" };
export default function Page() {
  return <StudentView page="support" />;
}
