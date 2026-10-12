import Link from "@/components/ui/LoadingLink";
import { notFound, redirect } from "next/navigation";
import { MapPin, Package, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { vendorWantMatchService } from "@/lib/vendor-want-match-service";
import { SubmitWantOffer } from "@/components/vendor/SubmitWantOffer";
import { DemandGallery } from "@/components/vendor/DemandGallery";
import { demandBudget, MatchBadge, ReasonChips, TypePill } from "@/components/vendor/DemandBits";
import { wantImages } from "@/lib/want-images";
import { matchOfferProduct, offerableProducts } from "@/lib/offer-service";
export const dynamic = "force-dynamic";

export default async function DemandDetail({ params }: { params: { id: string } }) {
  const session = await getVendorFromSession({ allowUnapproved: true }); if (!session) redirect("/vendor/login");
  if (session.vendor.status !== "approved") return <main className="mx-auto w-full max-w-5xl p-4 sm:p-6"><h1 className="text-3xl font-bold">Customer Demand</h1><p className="my-4">Your store must be approved before you can view demand details.</p></main>;
  // No customer fields are selected: vendors never see the customer's contact details.
  const want = await prisma.want.findFirst({ where: { id: params.id, status: "OPEN", expiresAt: { gt: new Date() } }, select: { id: true, title: true, photo: true, requestType: true, description: true, category: true, city: true, quantity: true, condition: true, budgetMin: true, budgetMax: true, budgetFlexible: true, expiresAt: true, _count: { select: { interests: true } } } });
  if (!want) notFound();
  const [matches, existingOffer, offerable] = await Promise.all([
    vendorWantMatchService(session.vendor.id),
    prisma.wantOffer.findUnique({ where: { wantId_vendorId: { wantId: want.id, vendorId: session.vendor.id } }, select: { id: true, status: true } }),
    offerableProducts(prisma, session.vendor.id, want.quantity),
  ]);
  // Usually the server links the matching product itself; only ask the vendor when nothing matches.
  const chooseFrom = matchOfferProduct(offerable, want, 0) ? undefined : offerable.map(p => ({ id: p.id, name: p.name }));
  const match = matches.find(m => m.want.id === want.id);
  const budget = { min: want.budgetMin == null ? null : Number(want.budgetMin), max: want.budgetMax == null ? null : Number(want.budgetMax), flexible: want.budgetFlexible, label: demandBudget(want) };

  return <main className="mx-auto w-full min-w-0 max-w-5xl p-4 sm:p-6">
    <Link href="/vendor/dashboard/demand" className="mb-4 inline-flex text-sm font-bold text-brand-link">&larr; Back to customer demand</Link>
    {/* Two columns only from xl: at lg the sidebar leaves ~770px, too tight for the card plus a 400px form. */}
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:items-start">
      <article className="min-w-0 overflow-hidden rounded-2xl border border-[#D9E6D0] bg-white">
        <DemandGallery images={wantImages(want)} title={want.title} requestType={want.requestType} />
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2"><TypePill requestType={want.requestType} className="border border-[#D9E6D0] shadow-none" />{match && <MatchBadge score={match.score} />}</div>
          <h1 className="mt-2 break-words text-xl font-bold text-emerald-950 sm:text-2xl">{want.title}</h1>
          <p className="mt-1 text-base font-medium text-emerald-700">{demandBudget(want)}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden="true" />{want.city}</span>
            <span className="flex items-center gap-1.5"><Package className="h-4 w-4" aria-hidden="true" />Qty {want.quantity.toLocaleString("en-PK")}{want.condition && want.condition !== "Any" ? ` · ${want.condition}` : ""}</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden="true" />{want._count.interests} joined</span>
          </p>
          {want.description && <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-700">{want.description}</p>}
          {match && match.reasons.length > 0 && <div className="mt-4 border-t border-[#E6EEDF] pt-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Why it matches your store</p><ReasonChips reasons={match.reasons} /></div>}
        </div>
      </article>
      <aside className="min-w-0 xl:sticky xl:top-4">
        {existingOffer
          ? <div className="rounded-2xl border border-[#D9E6D0] bg-white p-4 sm:p-5"><p className="font-bold">You already sent an offer on this Want ({existingOffer.status.charAt(0) + existingOffer.status.slice(1).toLowerCase()}).</p><p className="mt-2 text-sm text-gray-600">Manage terms, counters, and withdrawal from My Offers instead of submitting a new one.</p><Link href={`/vendor/dashboard/offers#${existingOffer.id}`} className="mt-3 inline-block font-bold text-brand-link">Go to My Offers →</Link></div>
          : <SubmitWantOffer wantId={want.id} budget={budget} quantity={want.quantity} wantExpiresAt={want.expiresAt.toISOString()} chooseFrom={chooseFrom} />}
      </aside>
    </div>
  </main>;
}
