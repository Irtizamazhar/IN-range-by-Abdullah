/** Audited against implemented App Router destinations. Null means unavailable. */
export const FOOTER_EXPLORE = [
  { id: "shop", label: "Shop Products", href: "/products" },
  { id: "services", label: "Services", href: "/services" },
  { id: "gifts", label: "Gifts", href: "/gifts" },
  { id: "wants", label: "Wants", href: "/wants" },
  { id: "request", label: "Request a Want", href: null, action: "request" },
  { id: "trending", label: "Trending Wants", href: "/wants/trending" },
  { id: "connect", label: "Connect", href: "/joro-connect" },
  { id: "stores", label: "Stores", href: "/stores" },
  { id: "seller", label: "Become a Seller", href: "/sell" },
  { id: "grow", label: "Grow", href: null },
  { id: "about", label: "About Us", href: "/about" },
] as const;

export const FOOTER_HELP = [
  { id: "track", label: "Track Order", href: "/track-order" },
  { id: "returns", label: "Return Policy", href: "/return-policy" },
  { id: "faq", label: "Help & FAQ", href: "/faq" },
  { id: "contact", label: "Contact & Support", href: "/account/help" },
  { id: "terms", label: "Terms & Conditions", href: "/terms-and-conditions" },
  { id: "privacy", label: "Privacy Policy", href: "/privacy-policy" },
  { id: "cart", label: "Cart", href: "/cart" },
] as const;

export type FooterDestination = { readonly id: string; readonly label: string; readonly href: string | null; readonly action?: "request" };
