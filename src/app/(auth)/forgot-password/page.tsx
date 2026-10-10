import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-forms";
export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AuthForm kind="forgot_password" />;
}
