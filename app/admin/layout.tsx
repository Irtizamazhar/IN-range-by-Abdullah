import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminBasePath } from "@/lib/admin-path";
import { AdminPathProvider } from "@/components/admin/AdminPathContext";
import { AdminChrome } from "./AdminChrome";
import { AdminSessionProvider } from "./AdminSessionProvider";

// ADMIN_SECRET_PATH is read per request, so the admin panel never depends on build-time values.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const base = adminBasePath();
  if (!base) notFound();
  return (
    <AdminPathProvider base={base}>
      <AdminSessionProvider>
        <AdminChrome>{children}</AdminChrome>
      </AdminSessionProvider>
    </AdminPathProvider>
  );
}
