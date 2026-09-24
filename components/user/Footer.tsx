"use client";

import Image from "next/image";
import Link from "next/link";

import { LogoMark } from "./LogoMark";
import { BrandTagline } from "./BrandTagline";
import { WhatsAppIconLink } from "./WhatsAppButton";
import type { ISettings } from "@/types/settings";
import { SOCIAL_LINKS } from "@/lib/social-links";

const SOCIAL_PROFILES = [
  {
    key: "facebook",
    label: "Facebook",
    path: "M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.931-1.956 1.887v2.263h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z",
  },
  {
    key: "instagram",
    label: "Instagram",
    path: "M12 0C8.74 0 8.333.014 7.053.072 5.775.13 4.902.334 4.14.63a5.88 5.88 0 0 0-2.126 1.384A5.88 5.88 0 0 0 .63 4.14C.334 4.902.13 5.775.072 7.053.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.058 1.278.262 2.151.558 2.913a5.88 5.88 0 0 0 1.384 2.126A5.88 5.88 0 0 0 4.14 23.37c.762.296 1.635.5 2.913.558C8.333 23.986 8.74 24 12 24s3.667-.014 4.947-.072c1.278-.058 2.151-.262 2.913-.558a5.88 5.88 0 0 0 2.126-1.384 5.88 5.88 0 0 0 1.384-2.126c.296-.762.5-1.635.558-2.913C23.986 15.667 24 15.26 24 12s-.014-3.667-.072-4.947c-.058-1.278-.262-2.151-.558-2.913a5.88 5.88 0 0 0-1.384-2.126A5.88 5.88 0 0 0 19.86.63c-.762-.296-1.635-.5-2.913-.558C15.667.014 15.26 0 12 0Zm0 2.162c3.204 0 3.584.012 4.85.07 1.17.053 1.805.249 2.228.413.56.218.96.478 1.38.897.42.42.68.82.897 1.38.164.423.36 1.058.413 2.228.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.053 1.17-.249 1.805-.413 2.228a3.72 3.72 0 0 1-.897 1.38c-.42.42-.82.68-1.38.897-.423.164-1.058.36-2.228.413-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.053-1.805-.249-2.228-.413a3.72 3.72 0 0 1-1.38-.897 3.72 3.72 0 0 1-.897-1.38c-.164-.423-.36-1.058-.413-2.228-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.053-1.17.249-1.805.413-2.228.218-.56.478-.96.897-1.38.42-.42.82-.68 1.38-.897.423-.164 1.058-.36 2.228-.413 1.266-.058 1.646-.07 4.85-.07Zm0 3.676a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.846-10.405a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z",
  },
  {
    key: "tiktok",
    label: "TikTok",
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z",
  },
  {
    key: "x",
    label: "X (Twitter)",
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
] as const;

const SOCIAL_BUTTON_CLASS =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/50 transition-[color,background-color,border-color,transform,box-shadow] duration-200 motion-reduce:transition-none cursor-pointer hover:scale-110 hover:border-brand-primary/50 hover:bg-brand-primary/15 hover:text-brand-primary hover:shadow-[0_0_14px_rgb(var(--brand-primary-rgb)/0.2)] motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark";

const PAYMENT_METHODS = [
  {
    src: "/payments/visa.png",
    alt: "Visa",
  },
  {
    src: "/payments/mastercard.png",
    alt: "Mastercard",
  },
  {
    src: "/payments/easypaisa.png",
    alt: "Easypaisa",
  },
  {
    src: "/payments/jazzcash.png",
    alt: "JazzCash",
  },
] as const;

export function Footer({
  settings,
}: {
  settings: Pick<
    ISettings,
    "whatsappNumber" | "shopName"
  >;
}) {
  const {
    whatsappNumber,
  } = settings;

  return (
    <footer className="mt-auto bg-brand-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
        <div className="grid gap-9 md:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr]">
          <div>
            <div className="inline-flex flex-col items-center">
              <LogoMark inverse href="/" />
              <BrandTagline inverse />
            </div>

            <p className="mt-4 max-w-sm text-xs font-medium leading-5 text-white/45">
              More than shopping.
              JORO.pk connects products,
              customer demand, sellers and
              local businesses in one
              marketplace.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <WhatsAppIconLink
                number={
                  whatsappNumber
                }
                className="text-brand-primary transition hover:text-white"
              />

              <span className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white/45">
                Made for Pakistan
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-black uppercase tracking-[0.14em] text-brand-primary">
              Marketplace
            </h3>

            <ul className="mt-4 space-y-2.5 text-xs font-medium text-white/50">
              <li>
                <Link
                  href="/products"
                  className="hover:text-white"
                >
                  Shop
                </Link>
              </li>

              <li>
                <Link
                  href="/wants"
                  className="hover:text-white"
                >
                  Wants
                </Link>
              </li>

              <li>
                <Link
                  href="/wants"
                  className="hover:text-white"
                >
                  Trending Wants
                </Link>
              </li>

              <li>
                <Link
                  href="/stores"
                  className="hover:text-white"
                >
                  Stores
                </Link>
              </li>

              <li>
                <a
                  href="/sell"

                  className="font-bold text-brand-primary hover:text-white"
                >
                  Sell on JORO
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[12px] font-black uppercase tracking-[0.14em] text-brand-primary">
              Help
            </h3>

            <ul className="mt-4 space-y-2.5 text-xs font-medium text-white/50">
              <li>
                <Link
                  href="/track-order"
                  className="hover:text-white"
                >
                  Track Order
                </Link>
              </li>

              <li>
                <Link
                  href="/return-policy"
                  className="hover:text-white"
                >
                  Return Policy
                </Link>
              </li>

              <li>
                <Link
                  href="/faq"
                  className="hover:text-white"
                >
                  Help & FAQ
                </Link>
              </li>

              <li>
                <Link
                  href="/terms-and-conditions"
                  className="hover:text-white"
                >
                  Terms & Conditions
                </Link>
              </li>

              <li>
                <Link
                  href="/cart"
                  className="hover:text-white"
                >
                  Cart
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[12px] font-black uppercase tracking-[0.14em] text-brand-primary">
              Payments
            </h3>

            <div className="mt-4 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(
                (method) => (
                  <div
                    key={
                      method.alt
                    }
                    className="flex h-9 w-[62px] items-center justify-center rounded-lg bg-white px-2.5 shadow-sm"
                  >
                    <Image
                      src={
                        method.src
                      }
                      alt={
                        method.alt
                      }
                      width={64}
                      height={36}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )
              )}
            </div>

            <p className="mt-4 text-[12px] font-medium leading-5 text-white/50">
              WhatsApp:{" "}

              <a
                href={`https://wa.me/${whatsappNumber.replace(
                  /\D/g,
                  ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand-primary hover:underline"
              >
                {
                  whatsappNumber
                }
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-4 text-center text-[11px] font-semibold text-white/40 sm:px-6 md:flex-row md:text-left">
          <span className="md:min-w-0 md:flex-1">
            ©{" "}
            {new Date().getFullYear()}{" "}
            JORO.pk. All rights reserved.
          </span>

          <ul aria-label="Follow JORO.pk" className="flex shrink-0 items-center gap-3">
            {SOCIAL_PROFILES.map(({ key, label, path }) => {
              const url = SOCIAL_LINKS[key].trim();
              const icon = (
                <svg
                  viewBox="0 0 24 24"
                  className="h-[18px] w-[18px]"
                  fill="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d={path} />
                </svg>
              );

              return (
                <li key={key} className="flex">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Follow JORO.pk on ${label} (opens in a new tab)`}
                      className={SOCIAL_BUTTON_CLASS}
                    >
                      {icon}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-label={`${label} (not configured)`}
                      title={`${label} — coming soon`}
                      className={SOCIAL_BUTTON_CLASS}
                    >
                      {icon}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex justify-center md:min-w-0 md:flex-1 md:justify-end">
            <BrandTagline inverse />
          </div>
        </div>
      </div>
    </footer>
  );
}
