import Link from "@/components/ui/LoadingLink";
import { ShoppingCart } from "lucide-react";
import { OfferCenter } from "@/components/user/OfferCenter";
import { AccountPrivate } from "@/components/user/AccountPrivate";
import { AccountPageHero } from "@/components/user/AccountPageParts";
export default function OffersPage() {
  return <main className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 sm:pt-5">
    <AccountPageHero id="offers-heading" eyebrow="Your JORO space" title="Received Offers" image={{ src: "/images/account/joro-bag-parcels.webp", alt: "JORO shopping bag with delivered parcels", width: 960, height: 480 }}
      action={<Link href="/cart" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-link underline underline-offset-4 hover:text-[#005235] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link"><ShoppingCart className="h-4 w-4" aria-hidden="true" />View personal cart</Link>}>
      View and manage offers you&apos;ve received from sellers and service providers.
    </AccountPageHero>
    <AccountPrivate><OfferCenter /></AccountPrivate>
  </main>;
}
