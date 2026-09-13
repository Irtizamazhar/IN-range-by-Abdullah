import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ShopCategory = {
  id: number;
  name: string;
  image: string;
  showOnHome?: boolean;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "category";
}

/** Compatibility shape for existing components, now sourced from MySQL. */
export async function readCategories(): Promise<ShopCategory[]> {
  const rows = await prisma.category.findMany({
    where: { isActive: true, legacyId: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((row) => ({
    id: row.legacyId!,
    name: row.name,
    image: row.image,
    showOnHome: row.showOnHome,
  }));
}

export async function writeCategories(categories: ShopCategory[]) {
  const ids = categories.map((item) => Number(item.id));
  await prisma.$transaction(
    async (tx) => {
      await tx.category.deleteMany({
        where: {
          legacyId: {
            not: null,
            ...(ids.length ? { notIn: ids } : {}),
          },
        },
      });
      for (let index = 0; index < categories.length; index++) {
        const item = categories[index]!;
        const name = String(item.name || "").trim();
        await tx.category.upsert({
          where: { legacyId: item.id },
          create: {
            legacyId: item.id,
            name,
            slug: `${slugify(name)}-${item.id}`,
            image: String(item.image || "/uploads/categories/default-category.jpg"),
            showOnHome: item.showOnHome === true,
            sortOrder: index,
          },
          update: {
            name,
            image: String(item.image || "/uploads/categories/default-category.jpg"),
            showOnHome: item.showOnHome === true,
            sortOrder: index,
          },
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export function nextCategoryId(categories: ShopCategory[]) {
  return categories.length ? Math.max(...categories.map((category) => category.id)) + 1 : 1;
}
