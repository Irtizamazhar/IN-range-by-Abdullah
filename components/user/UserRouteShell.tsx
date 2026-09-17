"use client";

import { Suspense } from "react";
import { AnnouncementBar } from "@/components/user/AnnouncementBar";
import { Navbar } from "@/components/user/Navbar";
import { Footer } from "@/components/user/Footer";
import { WhatsAppFloat } from "@/components/user/WhatsAppButton";
import { CartProvider } from "@/context/CartContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import type { ISettings } from "@/types/settings";

type FooterSettings = Pick<ISettings, "whatsappNumber" | "shopName">;

export function UserRouteShell({
  whatsappNumber,
  footerSettings,
  children,
}: {
  whatsappNumber: string;
  footerSettings: FooterSettings;
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <CustomerAuthProvider>
        <div className="flex min-h-screen flex-col overflow-x-clip bg-white pb-16 md:pb-0">
          <AnnouncementBar />
          <Suspense
            fallback={
              <header
                className="sticky top-10 z-40 h-16 w-full shrink-0 border-b border-neutral-200 bg-white"
                aria-hidden
              />
            }
          >
            <Navbar whatsappNumber={whatsappNumber} />
          </Suspense>
          <main className="min-w-0 flex-1">{children}</main>
          <Footer settings={footerSettings} />
          <WhatsAppFloat number={whatsappNumber} />
        </div>
      </CustomerAuthProvider>
    </CartProvider>
  );
}
