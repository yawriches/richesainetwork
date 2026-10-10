import type { Metadata } from "next";
import { Suspense } from "react";
import { Marketplace } from "@/components/marketplace";
export const metadata: Metadata = { title: "Marketplace" };
export default function Page() {
  return (
    <Suspense fallback={<p className="loading">Loading marketplace…</p>}>
      <Marketplace />
    </Suspense>
  );
}
