import { SiteLayout } from "@/components/site";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteLayout>{children}</SiteLayout>;
}
