"use client";

import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import {
  ArrowUpRight, Banknote, ChevronDown, CircleHelp, CreditCard, FileText,
  Gift, MessageCircle, Package, PlusCircle, RotateCcw, ShoppingBag,
  ShoppingCart, Store, Tag, TrendingUp, Users, Wrench,
} from "lucide-react";
import { LogoMark } from "./LogoMark";
import { SOCIAL_LINKS } from "@/lib/social-links";
import type { ISettings } from "@/types/settings";
import styles from "./Footer.module.css";

const explore = [
  { label: "Shop Products", href: "/products", Icon: ShoppingBag },
  { label: "Services", href: "/services", Icon: Wrench },
  { label: "Gifts", href: "/gifts", Icon: Gift },
  { label: "Wants & Offers", href: "/wants", Icon: Tag },
  { label: "Trending Wants", href: "/wants/trending", Icon: TrendingUp },
  { label: "Wants", href: "/wants", Icon: Users },
  { label: "Stores", href: "/stores", Icon: Store },
  { label: "Sell on JORO", href: "/sell", Icon: PlusCircle },
] as const;
const help = [
  { label: "Track Order", href: "/track-order", Icon: Package },
  { label: "Return Policy", href: "/return-policy", Icon: RotateCcw },
  { label: "Help & FAQ", href: "/faq", Icon: CircleHelp },
  { label: "Terms & Conditions", href: "/terms-and-conditions", Icon: FileText },
  { label: "Cart", href: "/cart", Icon: ShoppingCart },
] as const;
const socials = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "x", label: "X" },
] as const;

function FooterLinks({ items }: { items: readonly { label: string; href: string; Icon: typeof ShoppingBag }[] }) {
  return <ul className={styles.links}>{items.map(({ label, href, Icon }) => <li key={href}><Link href={href}><Icon aria-hidden="true" /><span>{label}</span></Link></li>)}</ul>;
}

function Contact({ number }: { number: string }) {
  const digits = number.replace(/\D/g, "");
  if (!digits || digits === "923001234567") return null;
  return <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className={styles.contact}><MessageCircle aria-hidden="true" /><span>WhatsApp: <strong>{number}</strong></span><ArrowUpRight aria-hidden="true" className={styles.contactArrow} /></a>;
}

function Payments() {
  return <div className={styles.payment}><Banknote aria-hidden="true" /><span><strong>Cash on Delivery</strong><small>Available in eligible cities at checkout.</small></span></div>;
}

function SocialLinks() {
  return <ul aria-label="JORO.pk social media" className={styles.socials}>{socials.map(({ key, label }) => {
    const url = SOCIAL_LINKS[key].trim();
    const icon = <Image src={`/branding/social/${key}.png`} alt="" width={28} height={28} className={styles.socialImage} />;
    return <li key={key}>{url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Follow JORO.pk on ${label} (opens in a new tab)`} className={styles.socialIcon}>{icon}</a> : <span className={`${styles.socialIcon} ${styles.socialDisabled}`} role="img" aria-label={`${label} — coming soon`} title={`${label} — coming soon`}>{icon}</span>}</li>;
  })}</ul>;
}

function Brand() {
  return <div className={styles.brand}><LogoMark href="/" /><p>Pakistan&apos;s marketplace for products, services, gifts and home solutions. Post what you need and connect with sellers.</p><span className={styles.badge}><span aria-hidden="true">☪</span> Made for Pakistan</span></div>;
}

export function Footer({ settings }: { settings: Pick<ISettings, "whatsappNumber" | "shopName"> }) {
  return <footer className={styles.footer}>
    <div className={styles.panel}>
      <div className={styles.desktop}>
        <Brand />
        <div className={styles.column}><h2>Explore JORO</h2><FooterLinks items={explore} /></div>
        <div className={styles.column}><h2>Help</h2><FooterLinks items={help} /></div>
        <div className={styles.column}><h2>Payments &amp; Contact</h2><Payments /><Contact number={settings.whatsappNumber} /></div>
      </div>
      <div className={styles.mobile}>
        <Brand />
        <details className={styles.accordion}><summary><ShoppingBag aria-hidden="true" />Explore JORO<ChevronDown aria-hidden="true" /></summary><FooterLinks items={explore} /></details>
        <details className={styles.accordion}><summary><CircleHelp aria-hidden="true" />Help<ChevronDown aria-hidden="true" /></summary><FooterLinks items={help} /></details>
        <details className={styles.accordion}><summary><CreditCard aria-hidden="true" />Payments &amp; Contact<ChevronDown aria-hidden="true" /></summary><Payments /></details>
        <Contact number={settings.whatsappNumber} />
      </div>
      <div className={styles.skyline} aria-hidden="true"><Image src="/branding/footer/pakistan-skyline.png" alt="" fill sizes="(max-width: 639px) 390px, (max-width: 1024px) 768px, 1280px" className={styles.skylineImage} /></div>
      <div className={styles.bottom}><span className={styles.copyright}>© {new Date().getFullYear()} JORO.pk. All rights reserved.</span><SocialLinks /><nav aria-label="Footer shortcuts" className={styles.motto}><Link href="/products">Shop</Link><b aria-hidden="true">·</b><Link href="/wants/new">Post</Link><b aria-hidden="true">·</b><Link href="/wants">Wants</Link></nav></div>
    </div>
  </footer>;
}
