import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { vendorWantMatchService } from "@/lib/vendor-want-match-service";
import { DemandBoard, type DemandItem } from "@/components/vendor/DemandBoard";
export const dynamic = "force-dynamic";

const header = <><h1 className="text-2xl font-black text-emerald-950 sm:text-3xl">Customer demand</h1><p className="mt-1 text-sm text-gray-500">Open customer requests matched to your store category, catalog, city and prices.</p></>;

export default async function DemandPage() {
  const session = await getVendorFromSession({ allowUnapproved: true }); if (!session) redirect("/vendor/login");
  if (session.vendor.status !== "approved") return <main className="p-4 sm:p-6">{header}<p className="mt-4">Your store must be approved before you can browse customer demand.</p></main>;
  const matches = await vendorWantMatchService(session.vendor.id);
  // Plain numbers only: Prisma Decimals cannot cross into the client board.
  const toItem = ({ want, score, reasons }: (typeof matches)[number]): DemandItem => ({
    id: want.id, title: want.title, requestType: want.requestType, city: want.city, quantity: want.quantity, joined: want._count.interests, images: want.images,
    budgetMin: want.budgetMin == null ? null : Number(want.budgetMin), budgetMax: want.budgetMax == null ? null : Number(want.budgetMax), budgetFlexible: want.budgetFlexible,
    score, reasons,
  });
  return <main className="min-w-0 p-4 sm:p-6">
    <div className="mb-5">{header}</div>
    <DemandBoard matching={matches.filter(m => m.score > 0).map(toItem)} others={matches.filter(m => m.score === 0).map(toItem)} />
  </main>;
}
