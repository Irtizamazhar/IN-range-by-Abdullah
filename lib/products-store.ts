import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type StoredProduct = {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  image: string;
  images?: string[];
  description?: string;
  isNew: boolean;
  stock: number;
  inStock: boolean;
  isFeatured: boolean;
  createdAt: string;
};

function imagesFromJson(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "category";
}

/** Compatibility shape for existing new-arrival UI, now sourced from MySQL. */
export async function readProducts(): Promise<StoredProduct[]> {
  const rows = await prisma.product.findMany({
    where: { legacyNewArrivalId: { not: null } },
    orderBy: [{ legacyNewArrivalId: "desc" }],
  });
  return rows.map((row) => {
    const images = imagesFromJson(row.listingImageUrls);
    return {
      id: row.legacyNewArrivalId!,
      name: row.name,
      price: Number(row.price),
      originalPrice: row.originalPrice == null ? undefined : Number(row.originalPrice),
      category: row.category,
      image: images[0] || "",
      images,
      description: row.description || undefined,
      isNew: row.isActive,
      stock: row.stock,
      inStock: row.stock > 0 && row.isActive,
      isFeatured: row.isFeatured,
      createdAt: row.createdAt.toISOString().slice(0, 10),
    };
  });
}

/** Existing admin routes keep their payloads while persistence is transactional. */
export async function writeProducts(products: StoredProduct[]) {
  const ids = products.map((item) => Number(item.id));
  await prisma.$transaction(
    async (tx) => {
      await tx.product.deleteMany({
        where: {
          legacyNewArrivalId: {
            not: null,
            ...(ids.length ? { notIn: ids } : {}),
          },
        },
      });

      for (const item of products) {
        const categoryName = String(item.category || "Other").trim() || "Other";
        let category = await tx.category.findUnique({ where: { name: categoryName } });
        if (!category) {
          category = await tx.category.create({
            data: {
              name: categoryName,
              slug: `${slugify(categoryName)}-${item.id}`,
              image: "/uploads/categories/default-category.jpg",
              showOnHome: false,
              sortOrder: 10_000 + item.id,
            },
          });
        }
        const images = (item.images?.length ? item.images : [item.image])
          .map((image) => String(image || "").trim())
          .filter(Boolean);
        const price = Math.max(0, Number(item.price) || 0);
        const original = Number(item.originalPrice);
        const discountPercent =
          Number.isFinite(original) && original > price && original > 0
            ? Math.min(100, Math.round(((original - price) / original) * 100))
            : 0;
        const data = {
          name: String(item.name).trim(),
          description: String(item.description || ""),
          price: new Prisma.Decimal(price.toFixed(2)),
          originalPrice:
            Number.isFinite(original) && original > price
              ? new Prisma.Decimal(original.toFixed(2))
              : null,
          discountPercent,
          category: categoryName,
          categoryRecordId: category.id,
          stock: Math.max(0, Math.trunc(Number(item.stock) || 0)),
          variants: [] as Prisma.InputJsonValue,
          listingImageUrls: images as Prisma.InputJsonValue,
          isActive: item.isNew !== false,
          isFeatured: item.isFeatured === true,
        };
        await tx.product.upsert({
          where: { id: `na-${item.id}` },
          create: {
            id: `na-${item.id}`,
            legacyNewArrivalId: item.id,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            ...data,
          },
          update: data,
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export function nextProductId(products: StoredProduct[]) {
  return products.length ? Math.max(...products.map((product) => Number(product.id))) + 1 : 1;
}
