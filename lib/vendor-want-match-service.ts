import { prisma } from "@/lib/prisma";
import { wantTrendService } from "@/lib/want-trend-service";
/** Explainable relevance score, not a probability or trust rating. */
export async function vendorWantMatchService(vendorId: string) {
  const [vendor, wants] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { primaryCategory: true, city: true, status: true, products: { where: { status: "active", stock: { gt: 0 } }, select: { productName: true, category: true, price: true }, take: 500 } } }),
    wantTrendService(),
  ]);
  if (!vendor) return [];
  return wants.map(w => {
    const reasons: string[] = []; let score = 0;
    if (vendor.primaryCategory.toLowerCase() === w.category.toLowerCase()) { score += 40; reasons.push("Matches your store category"); }
    const matching = vendor.products.filter(p => p.category.toLowerCase() === w.category.toLowerCase());
    if (matching.length) { score += 20; reasons.push("Matching product category found"); }
    const words = w.title.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    if (matching.some(p => words.some(t => p.productName.toLowerCase().includes(t)))) { score += 20; reasons.push("Matching product keywords found"); }
    if (vendor.city.toLowerCase() === w.city.toLowerCase()) { score += 10; reasons.push("Same city as your store"); }
    if (matching.some(p => w.budgetFlexible || (Number(p.price) >= Number(w.budgetMin || 0) && Number(p.price) <= Number(w.budgetMax)))) { score += 10; reasons.push("Product price fits the budget"); }
    return { want: w, score, reasons };
  }).sort((a,b) => b.score - a.score);
}