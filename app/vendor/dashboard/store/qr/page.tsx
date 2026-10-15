import { vendorStoreQrUrl } from "@/lib/vendor-store-qr-url";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { StoreQr } from "@/components/vendor/StoreQr";
export const dynamic = "force-dynamic";
export default async function QrPage() {
  const s = await getVendorFromSession({ allowUnapproved: true }); if (!s) redirect("/vendor/login");
  const store = await prisma.vendor.findUnique({ where: { id: s.vendor.id }, select: { id: true, shopName: true, storeSlug: true, shopLogo: true, status: true } });
  if (!store || store.status !== "approved") return <main className="p-6">Your store must be approved before publishing its QR.</main>;
  return <main className="mx-auto max-w-2xl p-6"><h1 className="mb-5 text-3xl font-bold">Store QR</h1><StoreQr name={store.shopName} url={vendorStoreQrUrl(store.id)} /></main>;
}
