import type { Metadata } from "next";
import { StudentView } from "@/components/portal";
export const metadata: Metadata = { title: "Notifications" };
export default function Page() {
  return <StudentView page="notifications" />;
}
