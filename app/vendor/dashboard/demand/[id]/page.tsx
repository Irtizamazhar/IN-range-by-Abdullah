import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { SubmitWantOffer } from "@/components/vendor/SubmitWantOffer";
export const dynamic = "force-dynamic";
export default async function DemandDetail({ params }: { params: { id: string } }) {
  const session = await getVendorFromSession(); if (!session) redirect("/vendor/login");
  const want = await prisma.want.findFirst({ where: { id: params.id, status: "OPEN", expiresAt: { gt: new Date() } }, select: { id: true, title: true, description: true, city: true, quantity: true } }); if (!want) notFound();
  const products = await prisma.product.findMany({ where: { isActive: true, vendorPublication: { vendorId: session.vendor.id, status: "active" } }, select: { id: true, name: true }, take: 200 });
  return <main className="mx-auto max-w-4xl p-6"><h1 className="text-3xl font-bold">{want.title}</h1><p className="my-3">{want.city} · Quantity {want.quantity}</p><p className="whitespace-pre-wrap">{want.description}</p>{session.vendor.status === "approved" ? <SubmitWantOffer wantId={want.id} products={products} /> : <p>Your store must be approved before submitting offers.</p>}</main>;
}