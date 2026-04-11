"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/Sidebar";

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return (
      <div className="min-h-screen font-sans antialiased">{children}</div>
    );
  }
  return (
    <div className="flex min-h-screen bg-[#F8F9FA] font-sans antialiased">
      <AdminSidebar />
      <div className="flex-1 overflow-auto font-sans">{children}</div>
    </div>
  );
}
