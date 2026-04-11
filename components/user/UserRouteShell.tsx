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
        <div className="flex min-h-screen flex-col overflow-x-hidden bg-white">
          <AnnouncementBar />
          <Suspense
            fallback={
              <header
                className="sticky top-0 z-50 h-16 w-full shrink-0 border-b border-neutral-200 bg-white"
                aria-hidden
              />
            }
          >
            <Navbar whatsappNumber={whatsappNumber} />
          </Suspense>
          <main className="flex-1 overflow-x-hidden">{children}</main>
          <Footer settings={footerSettings} />
          <WhatsAppFloat number={whatsappNumber} />
        </div>
      </CustomerAuthProvider>
    </CartProvider>
  );
}
