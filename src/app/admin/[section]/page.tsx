import type { Metadata } from "next";
import { AdminApp } from "@/components/admin";
type Props = { params: Promise<{ section: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  return {
    title: `${section.replaceAll("-", " ")} operations`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({ params }: Props) {
  const { section } = await params;
  return <AdminApp section={section} />;
}
