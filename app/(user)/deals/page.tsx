import Link from "@/components/ui/LoadingLink";
import { ArrowRight, Tags } from "lucide-react";

export const metadata = { title: "JORO Deals | Coming Soon" };

export default function DealsPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#F7F8F2] px-4 py-14 sm:px-6">
      <section className="w-full max-w-2xl rounded-[2rem] border border-[#DFEDE5] bg-white px-6 py-12 text-center shadow-lg shadow-emerald-950/5 sm:px-12 sm:py-16">
        <div aria-hidden="true" className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#EFFBF4] text-[#005235] shadow-inner"><Tags className="h-10 w-10" strokeWidth={1.6} /></div>
        <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.22em] text-[#005235]">Worth the wait</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#123D27] sm:text-4xl">JORO Deals</h1>
        <p className="mt-5 text-xl font-semibold text-[#123D27]">Exciting deals are coming soon!</p>
        <p className="mt-2 text-base text-[#506257]">We&apos;re preparing something special for you.</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/products" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B7E33A] px-6 py-3 font-bold text-[#123D27] transition hover:bg-[#a9d62e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005235]">Explore Products <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          <Link href="/" className="inline-flex items-center justify-center rounded-xl border border-[#005235] px-6 py-3 font-semibold text-[#005235] transition hover:bg-[#EFFBF4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005235]">Back to Home</Link>
        </div>
      </section>
    </main>
  );
}
