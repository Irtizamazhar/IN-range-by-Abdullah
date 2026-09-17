import {appOrigin} from "@/lib/app-url";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { StoreQr } from "@/components/vendor/StoreQr";
export const dynamic = "force-dynamic";
export default async function QrPage() {
  const s = await getVendorFromSession({ allowUnapproved: true }); if (!s) redirect("/vendor/login");
  const store = await prisma.vendor.findUnique({ where: { id: s.vendor.id }, select: { id: true, shopName: true, storeSlug: true, status: true } });
  const configured = appOrigin();
  if (!store || store.status !== "approved") return <main className="p-6">Your store must be approved before publishing its QR.</main>;
  let origin: string;
  try { const url = new URL(configured || ""); if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid public origin"); origin = url.origin; } catch { return <main className="p-6">Store QR is awaiting the site&apos;s canonical HTTPS address configuration.</main>; }
  return <main className="mx-auto max-w-2xl p-6"><h1 className="mb-5 text-3xl font-bold">Store QR</h1><StoreQr name={store.shopName} url={`${origin}/stores/${store.storeSlug || store.id}`} /></main>;
}