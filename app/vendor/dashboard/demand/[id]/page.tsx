import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { vendorWantMatchService } from "@/lib/vendor-want-match-service";
import { SubmitWantOffer } from "@/components/vendor/SubmitWantOffer";
export const dynamic = "force-dynamic";
export default async function DemandDetail({ params }: { params: { id: string } }) {
  const session = await getVendorFromSession({ allowUnapproved: true }); if (!session) redirect("/vendor/login");
  if (session.vendor.status !== "approved") return <main className="mx-auto max-w-4xl p-6"><h1 className="text-3xl font-bold">Customer Demand</h1><p className="my-4">Your store must be approved before you can view demand details.</p></main>;
  const want = await prisma.want.findFirst({ where: { id: params.id, status: "OPEN", expiresAt: { gt: new Date() } }, select: { id: true, title: true, description: true, category: true, city: true, quantity: true, condition: true, budgetMin: true, budgetMax: true, budgetFlexible: true, expiresAt: true, _count: { select: { interests: true } } } });
  if (!want) notFound();
  const [products, matches, existingOffer] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true, vendorPublication: { vendorId: session.vendor.id, status: "active" } }, select: { id: true, name: true }, take: 200 }),
    vendorWantMatchService(session.vendor.id),
    prisma.wantOffer.findUnique({ where: { wantId_vendorId: { wantId: want.id, vendorId: session.vendor.id } }, select: { id: true, status: true } }),
  ]);
  const match = matches.find(m => m.want.id === want.id);
  const budget = want.budgetFlexible ? "Budget flexible" : `PKR ${Number(want.budgetMin || 0).toLocaleString("en-PK")} – ${Number(want.budgetMax).toLocaleString("en-PK")}`;
  return <main className="mx-auto max-w-4xl p-6">
    <h1 className="text-3xl font-bold">{want.title}</h1>
    <p className="my-3">{want.category} · {want.city} · Quantity {want.quantity}{want.condition ? ` · ${want.condition}` : ""}</p>
    <p className="whitespace-pre-wrap">{want.description}</p>
    <div className="my-4 grid gap-3 rounded-2xl bg-brand-background p-4 text-sm sm:grid-cols-3">
      <span className="font-bold">{budget}</span>
      <span>{want._count.interests} interested</span>
      <span>Expires {want.expiresAt.toLocaleDateString("en-PK")}</span>
    </div>
    {match && match.reasons.length ? <div className="mb-4"><p className="font-bold text-brand-link">{match.score}/100 relevance</p><ul className="mt-2 list-inside list-disc text-sm">{match.reasons.map(r => <li key={r}>{r}</li>)}</ul></div> : null}
    {existingOffer ? <div className="rounded-2xl bg-brand-background p-5"><p className="font-bold">You already sent an offer on this Want ({existingOffer.status.charAt(0) + existingOffer.status.slice(1).toLowerCase()}).</p><p className="mt-2 text-sm text-gray-600">Manage terms, counters, and withdrawal from My Offers instead of submitting a new one.</p><Link href={`/vendor/dashboard/offers#${existingOffer.id}`} className="mt-3 inline-block font-bold text-brand-link">Go to My Offers →</Link></div> : <SubmitWantOffer wantId={want.id} products={products} />}
  </main>;
}