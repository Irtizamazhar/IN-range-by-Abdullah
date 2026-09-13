import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicStoreSelect } from "@/lib/store-service";
import { StoreFollowButton } from "@/components/user/StoreFollowButton";
export const dynamic = "force-dynamic";
export default async function StorePage({ params }: { params: { slug: string } }) {
  const store = await prisma.vendor.findFirst({ where: { status: "approved", OR: [{ storeSlug: params.slug }, { id: params.slug }] }, select: publicStoreSelect });
  if (!store) notFound();
  const products = await prisma.product.findMany({ where: { isActive: true, vendorPublication: { vendorId: store.id, status: "active" } }, select: { id: true, name: true, price: true, stock: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-7xl px-4 py-10"><Link href="/stores" className="text-brand-link">All stores</Link><header className="my-5 rounded-2xl bg-white p-6"><p className="text-sm text-brand-link">Approved vendor · {store.primaryCategory}</p><h1 className="my-3 text-3xl font-bold">{store.shopName}</h1><p className="mb-5 whitespace-pre-wrap">{store.shopDescription}</p><StoreFollowButton vendorId={store.id} initialCount={store._count.storeFollows} /></header><h2 className="my-5 text-2xl font-bold">Products & new arrivals</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.map(p => <Link href={`/products/${p.id}`} key={p.id} className="rounded-2xl border bg-white p-5"><h3 className="font-bold">{p.name}</h3><p className="my-2">PKR {Number(p.price).toLocaleString("en-PK")}</p><p className="text-sm text-gray-600">{p.stock > 0 ? "In stock" : "Currently unavailable"}</p></Link>)}</div>{!products.length && <p>No products available yet.</p>}{store.storePolicies && <section className="mt-8 rounded-2xl bg-white p-6"><h2 className="text-xl font-bold">Store policies</h2><p className="mt-3 whitespace-pre-wrap">{store.storePolicies}</p></section>}</main>;
}