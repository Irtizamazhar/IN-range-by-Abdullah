"use client";

import Link from "next/link";
import Image from "next/image";
import { WhatsAppIconLink } from "./WhatsAppButton";
import type { ISettings } from "@/types/settings";

const PAYMENT_METHODS = [
  { src: "/payments/visa.png", alt: "Visa" },
  { src: "/payments/mastercard.png", alt: "Mastercard" },
  { src: "/payments/easypaisa.png", alt: "Easypaisa" },
  { src: "/payments/jazzcash.png", alt: "JazzCash" },
] as const;

export function Footer({
  settings,
}: {
  settings: Pick<ISettings, "whatsappNumber" | "shopName">;
}) {
  const { whatsappNumber, shopName } = settings;

  return (
    <footer className="bg-footerDark text-white mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="mb-3">
            <Image
              src="/logo.png"
              alt={shopName}
              width={200}
              height={120}
              className="h-20 md:h-24 w-auto max-w-[220px] object-contain object-left"
            />
          </div>
          <p className="text-sm font-normal text-white/70">
            Quality products delivered across Pakistan — everything within your reach.
          </p>
          <div className="flex gap-4 mt-4">
            <WhatsAppIconLink
              number={whatsappNumber}
              className="text-primaryBlue hover:text-primaryYellow"
            />
            <a
              href="#"
              className="text-primaryBlue hover:text-primaryYellow inline-flex"
              aria-label="Instagram"
            >
              <svg
                className="h-6 w-6"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            <a
              href="#"
              className="text-primaryBlue hover:text-primaryYellow inline-flex"
              aria-label="Facebook"
            >
              <svg
                className="h-6 w-6"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-base font-semibold text-primaryYellow">Quick Links</h3>
          <ul className="space-y-2 text-sm font-normal text-white/80">
            <li>
              <Link href="/" className="hover:text-white">
                Home
              </Link>
            </li>
            <li>
              <Link href="/products" className="hover:text-white">
                All Products
              </Link>
            </li>
            <li>
              <Link href="/track-order" className="hover:text-white">
                Track Order
              </Link>
            </li>
            <li>
              <Link href="/return-policy" className="hover:text-white">
                Return Policy
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-white">
                Cart
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-base font-semibold text-primaryYellow">Contact</h3>
          <p className="text-sm font-normal text-white/80">
            WhatsApp:{" "}
            <a
              href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
              className="text-primaryBlue hover:underline"
            >
              {whatsappNumber}
            </a>
          </p>
        </div>

        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Secure Payment Methods
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {PAYMENT_METHODS.map((method) => (
              <div
                key={method.alt}
                className="flex h-9 w-16 items-center justify-center rounded-md bg-white px-3 py-1.5 shadow-md transition-transform duration-200 hover:scale-105 motion-reduce:transform-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static public payment badges */}
                <img
                  src={method.src}
                  alt={method.alt}
                  className="h-full w-full object-contain"
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5 shrink-0 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs font-medium text-green-400">
              100% Secure & Encrypted Payments
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs font-normal text-white/50">
        © {new Date().getFullYear()} In Range By Abdullah. All rights reserved.
      </div>
    </footer>
  );
}
