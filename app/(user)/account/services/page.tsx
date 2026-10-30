import Link from "@/components/ui/LoadingLink";
import { ServiceBookings } from "@/components/user/ServiceBookings";
import { AccountPrivate } from "@/components/user/AccountPrivate";
import { AccountPageHero } from "@/components/user/AccountPageParts";
export default function ServicesPage() {
  return <main className="mx-auto max-w-site px-4 pb-10 pt-4 sm:px-6 sm:pt-5">
    <AccountPageHero id="services-heading" eyebrow="Your JORO space" caps title="My Service Bookings" image={{ src: "/images/account/services-empty.webp", alt: "Calendar with service tools", width: 620, height: 392 }}
      action={<Link className="text-sm font-semibold text-brand-link underline underline-offset-4 hover:text-[#005235]" href="/my-stuff">My Stuff: purchases, warranties & after-sales</Link>}>
      View and manage your service bookings, track progress, and get support.
    </AccountPageHero>
    <AccountPrivate><ServiceBookings /></AccountPrivate>
  </main>;
}
