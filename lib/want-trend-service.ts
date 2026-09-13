import { prisma } from "@/lib/prisma";
import { demandScore } from "@/lib/want-ranking";
export async function wantTrendService(filters: { city?: string; category?: string; newest?: boolean } = {}) {
  const now = new Date();
  const recentStart = new Date(now.getTime() - 7 * 86400000);
  const previousStart = new Date(now.getTime() - 14 * 86400000);
  const wants = await prisma.want.findMany({
    where: { status: "OPEN", expiresAt: { gt: now }, ...(filters.city ? { city: filters.city } : {}), ...(filters.category ? { category: filters.category } : {}) },
    select: { id: true, title: true, category: true, city: true, budgetMin: true, budgetMax: true, budgetFlexible: true, quantity: true, createdAt: true, expiresAt: true, _count: { select: { interests: true } } },
    orderBy: { createdAt: "desc" }, take: 500,
  });
  const groups = await prisma.wantInterest.groupBy({ by: ["wantId"], where: { wantId: { in: wants.map(w => w.id) }, createdAt: { gte: recentStart } }, _count: { id: true } });
  const previous = await prisma.wantInterest.groupBy({ by: ["wantId"], where: { wantId: { in: wants.map(w => w.id) }, createdAt: { gte: previousStart, lt: recentStart } }, _count: { id: true } });
  const recentMap = new Map(groups.map(g => [g.wantId, g._count.id]));
  const previousMap = new Map(previous.map(g => [g.wantId, g._count.id]));
  const rows = wants.map(w => ({ ...w, score: demandScore(w._count.interests, recentMap.get(w.id) || 0, previousMap.get(w.id) || 0, (now.getTime() - w.createdAt.getTime()) / 86400000) }));
  return (filters.newest ? rows : rows.sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime())).slice(0, 60);
}