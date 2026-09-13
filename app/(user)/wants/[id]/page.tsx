import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, MessageSquareMore, PackageSearch } from "lucide-react";
import { WantOfferActions } from "@/components/user/WantOfferActions";
import { formatPKR } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function WantDetailPage({ params }: { params: { id: string } }) {
  const session = await getCustomerSession();
  const customerId = session?.user?.role === "customer" ? session.user.id : undefined;
  const want = await prisma.wantPost.findUnique({
    where: { id: params.id },
    include: {
      offers: {
        orderBy: { createdAt: "desc" },
        include: { vendor: { select: { id: true, shopName: true, city: true, status: true } } },
      },
      _count: { select: { offers: true } },
    },
  });
  if (!want || (want.status !== "open" && want.customerId !== customerId)) notFound();
  const isOwner = want.customerId === customerId;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href={isOwner ? "/account?tab=wants" : "/wants"} className="text-sm font-bold text-brand-link">← Back</Link>
      <section className="mt-4 rounded-[22px] border border-borderGray bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand-link">{want.category}</span><span className="rounded-full border border-borderGray px-3 py-1 text-xs font-bold capitalize text-darkText/60">{want.status}</span></div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-brand-dark">{want.title}</h1>
        <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-darkText/70">{want.description}</p>
        <div className="mt-6 grid gap-3 rounded-2xl bg-brand-background p-4 text-sm sm:grid-cols-4">
          <span className="inline-flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-brand-link" />{want.city}</span>
          <span className="font-semibold">Quantity: {want.quantity}</span>
          <span className="font-semibold capitalize">Condition: {want.condition || "Flexible"}</span>
          <span className="font-black text-brand-link">{want.budgetMax ? `Up to ${formatPKR(Number(want.budgetMax))}` : "Budget flexible"}</span>
        </div>
      </section>

      {isOwner ? (
        <section className="mt-7">
          <h2 className="flex items-center gap-2 text-xl font-black text-brand-dark"><MessageSquareMore className="h-5 w-5" />Seller offers ({want._count.offers})</h2>
          {want.offers.length ? <div className="mt-4 space-y-4">{want.offers.map((offer) => <article key={offer.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/stores/${offer.vendor.id}`} className="font-black text-brand-dark hover:text-brand-link">{offer.vendor.shopName}</Link><p className="text-xs text-darkText/45">Approved seller · {offer.vendor.city}</p></div><span className="text-lg font-black text-brand-link">{formatPKR(Number(offer.amount))}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-darkText/65">{offer.message}</p>{offer.estimatedDays ? <p className="mt-2 text-xs font-semibold text-darkText/50">Estimated fulfilment: {offer.estimatedDays} days</p> : null}{offer.status === "pending" ? <WantOfferActions wantId={want.id} offerId={offer.id} /> : <span className="mt-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-bold capitalize text-brand-link">{offer.status}</span>}</article>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-borderGray bg-white p-10 text-center text-darkText/55">No seller offers yet.</div>}
        </section>
      ) : (
        <section className="mt-7 rounded-2xl border border-brand-primary/25 bg-brand-soft p-6"><PackageSearch className="h-6 w-6 text-brand-link" /><h2 className="mt-2 font-black text-brand-dark">Are you an approved seller?</h2><p className="mt-1 text-sm text-darkText/60">Respond from Demand Opportunities in your seller dashboard.</p><Link href="/vendor/dashboard/wants" className="mt-4 inline-block text-sm font-black text-brand-link">Open seller opportunities →</Link></section>
      )}
    </main>
  );
}
