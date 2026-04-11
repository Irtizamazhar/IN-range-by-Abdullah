import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { StarBreakdown } from "@/lib/review-stats";

const approvedNewArrivalSelect = {
  id: true,
  name: true,
  rating: true,
  comment: true,
  imageUrl: true,
  createdAt: true,
} satisfies Prisma.NewArrivalReviewSelect;

export type ApprovedNewArrivalReviewRow = Prisma.NewArrivalReviewGetPayload<{
  select: typeof approvedNewArrivalSelect;
}>;

export async function getApprovedReviewsForNewArrival(
  newArrivalId: number
): Promise<ApprovedNewArrivalReviewRow[]> {
  return prisma.newArrivalReview.findMany({
    where: { newArrivalId, approved: true },
    orderBy: { createdAt: "desc" },
    select: approvedNewArrivalSelect,
  });
}

export async function createPendingNewArrivalReview(data: {
  name: string;
  email: string;
  rating: number;
  comment: string;
  newArrivalId: number;
  imageUrl?: string | null;
}) {
  return prisma.newArrivalReview.create({
    data: {
      name: data.name,
      email: data.email,
      rating: data.rating,
      comment: data.comment,
      newArrivalId: data.newArrivalId,
      imageUrl: data.imageUrl ?? null,
      approved: false,
    },
  });
}

export async function getNewArrivalReviewDashboard(newArrivalId: number) {
  const approved = await prisma.newArrivalReview.findMany({
    where: { newArrivalId, approved: true },
    select: { rating: true },
  });
  const totalCount = approved.length;
  const breakdown: StarBreakdown[] = [5, 4, 3, 2, 1].map((star) => {
    const count = approved.filter((x) => x.rating === star).length;
    return {
      star,
      count,
      percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    };
  });
  const averageRating =
    totalCount > 0
      ? Math.round(
          (approved.reduce((s, x) => s + x.rating, 0) / totalCount) * 10
        ) / 10
      : 0;
  return { averageRating, totalCount, breakdown };
}
