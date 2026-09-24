import {appOrigin} from "@/lib/app-url";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { StoreQr } from "@/components/vendor/StoreQr";
export const dynamic = "force-dynamic";
export default async function QrPage() {
  const s = await getVendorFromSession({ allowUnapproved: true }); if (!s) redirect("/vendor/login");
  const store = await prisma.vendor.findUnique({ where: { id: s.vendor.id }, select: { id: true, shopName: true, storeSlug: true, shopLogo: true, status: true } });
  if (!store || store.status !== "approved") return <main className="p-6">Your store must be approved before publishing its QR.</main>;
  let origin: string;
  try { const configured = appOrigin(); const url = new URL(configured || ""); if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid public origin"); origin = url.origin; } catch { return <main className="mx-auto max-w-2xl p-6"><h1 className="text-3xl font-bold">Store QR</h1><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">Configure <code>NEXT_PUBLIC_APP_URL</code> or <code>NEXTAUTH_URL</code> with your live HTTPS domain before generating a shareable QR. Localhost QR codes are intentionally disabled.</div></main>; }
  return <main className="mx-auto max-w-2xl p-6"><h1 className="mb-5 text-3xl font-bold">Store QR</h1><StoreQr name={store.shopName} logo={store.shopLogo} url={`${origin}/stores/${encodeURIComponent(store.storeSlug || store.id)}`} /></main>;
}