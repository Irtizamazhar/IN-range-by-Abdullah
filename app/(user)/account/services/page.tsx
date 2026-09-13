import Link from "next/link";
import { ServiceBookings } from "@/components/user/ServiceBookings";
import { AccountPrivate } from "@/components/user/AccountPrivate";
export default function ServicesPage() { return <main className="mx-auto max-w-5xl p-6"><h1 className="text-3xl font-bold">My Services</h1><Link className="mt-3 inline-block text-brand-link underline" href="/my-stuff">My Stuff: purchases, warranties & after-sales</Link><AccountPrivate><ServiceBookings /></AccountPrivate></main>; }