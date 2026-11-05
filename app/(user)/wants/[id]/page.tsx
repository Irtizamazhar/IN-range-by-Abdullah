import { requestCache } from "@/lib/seo-cache";
import { notFound } from "next/navigation";
import { seoWant } from "@/lib/seo-data";
import { pageMetadata, breadcrumbs } from "@/lib/seo";
import { resolveWantViewer } from "@/lib/want-engagement";
import { prisma } from "@/lib/prisma";
import { JsonLd } from "@/components/seo/JsonLd";
import WantDetailClient from "./WantDetailClient";
export const dynamic = "force-dynamic";
const privateOwnerAccess = requestCache(async (id: string) => {
  const viewer = await resolveWantViewer();
  return !!viewer.customerId && !!await prisma.want.findFirst({ where: { id, customerId: viewer.customerId }, select: { id: true } });
});
type Props = { params: { id: string }; searchParams?: { from?: string } };
export async function generateMetadata({ params }: Props) {
  const want = await seoWant(params.id);
  if (!want && !await privateOwnerAccess(params.id)) notFound();
  return want ? pageMetadata(want.title, want.description || `A public ${want.category} request in ${want.city} on JORO.PK.`, `/wants/${encodeURIComponent(want.id)}`, want.photo)
    : pageMetadata("Marketplace request", "View your marketplace request on JORO.PK.", `/wants/${encodeURIComponent(params.id)}`, undefined, true);
}
export default async function WantPage({ params, searchParams }: Props) {
  const want = await seoWant(params.id);
  if (!want && !await privateOwnerAccess(params.id)) notFound();
  return <>{want && <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Wants", path: "/wants" }, { name: want.title, path: `/wants/${encodeURIComponent(want.id)}` }])} />}
    <WantDetailClient params={params} searchParams={searchParams} publicTitle={want?.title} publicSummary={want?.description} /></>;
}
