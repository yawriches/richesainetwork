import type { Metadata } from "next";
import { StudentShell } from "@/components/portal";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Your learning",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <StudentShell>{children}</StudentShell>;
}
