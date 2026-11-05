import { SITE_URL, HOME_TITLE, HOME_DESCRIPTION } from "@/lib/seo";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";

import "./globals.css";
import { Providers } from "./providers";
import { GlobalNavigationLoader } from "@/components/ui/GlobalNavigationLoader";
import { PreviewExitControl } from "@/components/coming-soon-gate/PreviewExitControl";

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
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: "JORO.PK", type: "website", locale: "en_PK", title: HOME_TITLE, description: HOME_DESCRIPTION, images: [{ url: "/icon.png", alt: "JORO.PK" }] },
  twitter: { card: "summary", title: HOME_TITLE, description: HOME_DESCRIPTION, images: ["/icon.png"] },
  title: {
    default: HOME_TITLE,
    template: "%s | JORO.PK",
  },

  description:
    HOME_DESCRIPTION,

  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: "/icon.png",
    apple: "/icon.png",
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
          <Suspense fallback={null}>
            <GlobalNavigationLoader />
          </Suspense>
          <PreviewExitControl />
        </Providers>
      </body>
    </html>
  );
}
