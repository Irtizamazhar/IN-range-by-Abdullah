import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";

import "./globals.css";
import { Providers } from "./providers";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: [
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
  ],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: {
    default: "JORO.pk | Pakistan Marketplace",
    template: "%s | JORO.pk",
  },

  description:
    "JORO.pk connects customers, products and sellers across Pakistan. Shop products, post your wants and discover trusted marketplace sellers.",

  icons: {
    icon: "/icon.svg",
  },
};

function AppLoadingFallback() {
  return (
    <div
      className="min-h-screen w-full bg-[#F7F8F2]"
      aria-hidden="true"
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={jakarta.variable}
      suppressHydrationWarning
    >
      <body className="min-h-screen w-full overflow-x-hidden bg-[#F7F8F2] font-sans text-[#111111] antialiased">
        <Providers>
          <Suspense fallback={<AppLoadingFallback />}>
            {children}
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}