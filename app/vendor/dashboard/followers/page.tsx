import Link from "next/link";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export default async function FollowersPage() {
  const session = await getVendorFromSession({ allowUnapproved: true }); if (!session) redirect("/vendor/login");
  const vendorId = session.vendor.id;
  const [total, recent, store] = await Promise.all([
    prisma.storeFollow.count({ where: { vendorId } }),
    prisma.storeFollow.count({ where: { vendorId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { storeSlug: true } }),
  ]);
  return <main className="p-6"><h1 className="text-3xl font-bold">Followers</h1><div className="my-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border bg-white p-6"><p>Total followers</p><p className="text-3xl font-bold">{total}</p></div><div className="rounded-2xl border bg-white p-6"><p>Current followers who joined in the last 30 days</p><p className="text-3xl font-bold">{recent}</p></div></div><Link className="text-brand-link underline" href={`/stores/${store?.storeSlug || vendorId}`}>View public store</Link><p className="mt-4 text-sm text-gray-600">Following does not subscribe customers to promotional messages.</p></main>;
}