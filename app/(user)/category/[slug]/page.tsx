import { notFound, permanentRedirect } from "next/navigation";
import { seoCategory } from "@/lib/seo-data";
import { safeRedirectQuery } from "@/lib/catalog-urls";
export const dynamic = "force-dynamic";
/** Accept singular legacy links; retain the established plural canonical route. */
export default async function CategoryAlias({ params, searchParams }: {
  params: { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const category = await seoCategory(params.slug);
  if (!category) notFound();
  permanentRedirect("/categories/" + encodeURIComponent(category.slug) + safeRedirectQuery(searchParams));
}
