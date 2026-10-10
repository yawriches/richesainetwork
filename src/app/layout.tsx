import type { Metadata } from "next";
import { PREVIEW_ORIGIN } from "@/lib/supabase/server";
import { HERO_IMAGE_URL } from "@/lib/brand";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "Riches AI Network — Learn AI. Build skills.",
    template: "%s | Riches AI Network",
  },
  description:
    "Practical AI learning to help you build useful skills and move toward your next chapter.",
  metadataBase: new URL(process.env.APP_ORIGIN || PREVIEW_ORIGIN),
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "Riches AI Network",
    title: "Riches AI Network — Learn AI. Build skills.",
    description:
      "Practical AI learning with projects, expert feedback, and community.",
    images: [HERO_IMAGE_URL],
  },
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
