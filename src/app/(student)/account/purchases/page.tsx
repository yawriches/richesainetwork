import type { Metadata } from "next";
import { StudentView } from "@/components/portal";
export const metadata: Metadata = { title: "Purchases and billing" };
export default function Page() {
  return <StudentView page="purchases" />;
}
