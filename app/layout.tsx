import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "In Range By Abdullah | Online Shopping Pakistan",
  description:
    "Shop quality products with cash on delivery and bank transfer across Pakistan.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="w-full overflow-x-hidden font-sans antialiased">
        <div className="w-full overflow-x-hidden">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
