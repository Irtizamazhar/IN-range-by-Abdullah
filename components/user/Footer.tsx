"use client";

import Image from "next/image";
import Link from "next/link";
import {
  HeartHandshake,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";

import { LogoMark } from "./LogoMark";
import { WhatsAppIconLink } from "./WhatsAppButton";
import type { ISettings } from "@/types/settings";

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
      <div className="border-b border-white/[0.07] bg-[#0d1410]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-4">
          {[
            [
              ShieldCheck,
              "Secure Payments",
              "Multiple payment options",
            ],
            [
              Truck,
              "Nationwide Delivery",
              "Across Pakistan",
            ],
            [
              Store,
              "Verified Sellers",
              "Marketplace confidence",
            ],
            [
              HeartHandshake,
              "Support Local",
              "Grow together",
            ],
          ].map(
            ([
              Icon,
              title,
              text,
            ]) => {
              const BenefitIcon =
                Icon as typeof ShieldCheck;

              return (
                <div
                  key={String(
                    title
                  )}
                  className="bg-[#0d1410] px-4 py-4 text-center sm:text-left"
                >
                  <BenefitIcon className="mx-auto h-5 w-5 text-brand-primary sm:mx-0" />

                  <p className="mt-2 text-[10px] font-black">
                    {String(
                      title
                    )}
                  </p>

                  <p className="mt-0.5 text-[9px] font-medium text-white/35">
                    {String(
                      text
                    )}
                  </p>
                </div>
              );
            }
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
        <div className="grid gap-9 md:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr]">
          <div>
            <LogoMark
              inverse
              href="/"
            />

            <p className="mt-1 text-[9px] font-bold text-brand-primary/80">
              Customers aur vendors ko joro
            </p>

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

              <span className="rounded-full border border-white/10 px-3 py-1.5 text-[9px] font-bold text-white/35">
                Pakistan ko joro
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-primary">
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
                  href="/#wants"
                  className="hover:text-white"
                >
                  Wants
                </Link>
              </li>

              <li>
                <Link
                  href="/#trending-wants"
                  className="hover:text-white"
                >
                  Trending Wants
                </Link>
              </li>

              <li>
                <Link
                  href="/#stores"
                  className="hover:text-white"
                >
                  Stores
                </Link>
              </li>

              <li>
                <a
                  href="/vendor/register"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand-primary hover:text-white"
                >
                  Become a Seller
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-primary">
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
            <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-primary">
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

            <p className="mt-4 text-[10px] font-medium leading-5 text-white/40">
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
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-center text-[9px] font-semibold text-white/28 sm:flex-row sm:px-6 sm:text-left">
          <span>
            ©{" "}
            {new Date().getFullYear()}{" "}
            JORO.pk. All rights reserved.
          </span>

          <span>
            People • Products • Vendors • Together
          </span>
        </div>
      </div>
    </footer>
  );
}