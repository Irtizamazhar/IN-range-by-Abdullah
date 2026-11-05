import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("Marketplace Wants in Pakistan", "Explore public product, service and gift requests on JORO.PK, or post a Want to connect with marketplace sellers.", "/wants");
import { Suspense } from "react";
import { readCategories } from "@/lib/categories-store";
import { WantsFeed, WantsFeedSkeleton } from "./WantsFeed";
export const dynamic = "force-dynamic";
export default async function WantsPage() {
  const categories = await readCategories().catch(() => []);
  return <Suspense fallback={<WantsFeedSkeleton />}><WantsFeed categories={categories.map(category => category.name)} /></Suspense>;
}
