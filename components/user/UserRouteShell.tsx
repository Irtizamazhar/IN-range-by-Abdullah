"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
const LiveChat = dynamic(() => import("@/components/user/LiveChat").then(module => module.LiveChat), { ssr: false });
import { usePathname } from "next/navigation";
import { AnnouncementBar } from "@/components/user/AnnouncementBar";
import { Navbar } from "@/components/user/Navbar";
import { Footer } from "@/components/user/Footer";
import { WhatsAppFloat } from "@/components/user/WhatsAppButton";
import { CartProvider } from "@/context/CartContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { PostWantProvider } from "@/context/PostWantContext";
import type { ISettings } from "@/types/settings";

type FooterSettings = Pick<ISettings, "whatsappNumber" | "shopName">;

export function UserRouteShell({
  whatsappNumber,
  footerSettings,
  children,
  chatEnabled = false,
  newsletterEnabled = false,
}: {
  whatsappNumber: string;
  footerSettings: FooterSettings;
  children: React.ReactNode;
  chatEnabled?: boolean;
  newsletterEnabled?: boolean;
}) {
  // Order tracking is a standalone courier-style page without the shop chrome.
  const pathname = usePathname();
  const standalone = pathname === "/track-order";
  const checkout = pathname === "/checkout" || pathname === "/cart";
  return (
    <CartProvider>
      <CustomerAuthProvider>
        <PostWantProvider>
        {standalone ? (
          <main className="min-h-screen min-w-0 overflow-x-clip bg-white">{children}</main>
        ) : (
        <div className="flex min-h-screen flex-col overflow-x-clip bg-white pb-[calc(68px+env(safe-area-inset-bottom))] md:pb-0">
          <AnnouncementBar />
          <Suspense
            fallback={
              <header
                className="sticky top-10 z-40 h-16 w-full shrink-0 border-b border-neutral-200 bg-white"
                aria-hidden
              />
            }
          >
            <Navbar whatsappNumber={whatsappNumber} newsletterEnabled={newsletterEnabled} />
          </Suspense>
          <main className="min-w-0 flex-1">{children}</main>
          <Footer settings={footerSettings} />
          <WhatsAppFloat number={whatsappNumber} />
          {chatEnabled && !checkout && <LiveChat />}
        </div>
        )}
        </PostWantProvider>
      </CustomerAuthProvider>
    </CartProvider>
  );
}
