import { prisma } from "@/lib/prisma";

/** Resolve vendor input to the current admin-managed category name. */
export async function activeProductCategory(name: string) {
  return prisma.category.findFirst({
    where: { name: name.trim(), isActive: true },
    select: { id: true, name: true },
  });
}
