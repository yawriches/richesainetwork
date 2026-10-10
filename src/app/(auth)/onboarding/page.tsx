import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-forms";
export const metadata: Metadata = {
  title: "Set up your learning profile",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AuthForm kind="onboarding" />;
}
