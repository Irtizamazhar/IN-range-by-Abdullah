import Link from "next/link";
import type { Faq } from "@/lib/support-faq";

export function HelpCenterBody({
  categories, faqs, newTicketHref, ticketsHref,
}: {
  categories: readonly (readonly [string, string])[];
  faqs: Faq[];
  newTicketHref: string;
  ticketsHref: string;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-black text-darkText sm:text-3xl">Help &amp; Support</h1>
      <p className="mt-2 text-darkText/70">Browse a category, check common answers below, or create a support ticket if you still need help.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map(([value, label]) => (
          <a key={value} href={`#${value}`} className="rounded-xl border border-borderGray bg-white p-4 text-sm font-bold text-darkText transition hover:border-brand-primary hover:bg-brand-soft">
            {label}
          </a>
        ))}
      </div>

      <div className="mt-8 space-y-8">
        {categories.map(([value, label]) => {
          const items = faqs.filter(f => f.category === value);
          if (!items.length) return null;
          return (
            <section key={value} id={value} className="scroll-mt-24">
              <h2 className="text-lg font-black text-darkText">{label}</h2>
              <div className="mt-3 space-y-2">
                {items.map(faq => (
                  <details key={faq.question} className="rounded-xl border border-borderGray bg-white p-4">
                    <summary className="cursor-pointer font-bold text-darkText">{faq.question}</summary>
                    <p className="mt-2 text-sm text-darkText/75">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-10 rounded-2xl bg-brand-dark p-6 text-center text-white">
        <p className="text-lg font-black">Still need help?</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link href={newTicketHref} className="rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark">Create Support Ticket</Link>
          <Link href={ticketsHref} className="rounded-xl border border-white/25 px-5 py-3 font-bold text-white">My Tickets</Link>
        </div>
      </div>
    </div>
  );
}
