import { OfferCenter } from "@/components/user/OfferCenter";
import { AccountPrivate } from "@/components/user/AccountPrivate";
export default function OffersPage() { return <main className="mx-auto max-w-5xl p-6"><h1 className="text-3xl font-bold">Received Offers</h1><AccountPrivate><OfferCenter /></AccountPrivate></main>; }