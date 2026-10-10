import type { Metadata } from "next";
import { AdminApp } from "@/components/admin";
export const metadata: Metadata = {
  title: "Admin overview",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminApp section="overview" />;
}
