import type { Metadata } from "next";
import { MarketplaceCourse } from "@/components/marketplace";
export const metadata: Metadata = { title: "Course" };
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MarketplaceCourse slug={slug} />;
}
