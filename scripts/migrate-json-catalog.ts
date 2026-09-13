import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

type LegacyCategory = {
  id: number;
  name: string;
  image: string;
  showOnHome?: boolean;
};

type LegacyProduct = {
  id: number;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  category: string;
  stock?: number;
  inStock?: boolean;
  image?: string;
  images?: string[];
  isFeatured?: boolean;
  createdAt?: string;
};

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "category";
}

async function readJson<T>(name: string): Promise<T> {
  const raw = await readFile(path.join(process.cwd(), "data", name), "utf8");
  return JSON.parse(raw) as T;
}

async function main() {
  const existingLegacyProducts = await prisma.product.count({
    where: { legacyNewArrivalId: { not: null } },
  });
  if (existingLegacyProducts > 0) {
    console.log(`Catalog import already completed (${existingLegacyProducts} legacy products in DB).`);
    return;
  }

  const [categories, products] = await Promise.all([
    readJson<LegacyCategory[]>("categories.json"),
    readJson<LegacyProduct[]>("products.json"),
  ]);

  await prisma.$transaction(async (tx) => {
    const categoryIds = new Map<string, string>();
    let nextLegacyCategoryId =
      categories.reduce((max, category) => Math.max(max, Number(category.id) || 0), 0) + 1;
    for (let index = 0; index < categories.length; index++) {
      const legacy = categories[index]!;
      const name = String(legacy.name || "").trim();
      if (!name) continue;
      const category = await tx.category.upsert({
        where: { name },
        create: {
          legacyId: Number(legacy.id),
          name,
          slug: `${slugify(name)}-${Number(legacy.id)}`,
          image: String(legacy.image || "/uploads/categories/default-category.jpg"),
          showOnHome: legacy.showOnHome === true,
          sortOrder: index,
        },
        update: {},
      });
      categoryIds.set(name.toLowerCase(), category.id);
    }

    for (const legacy of products) {
      const categoryName = String(legacy.category || "Other").trim() || "Other";
      let categoryId = categoryIds.get(categoryName.toLowerCase());
      if (!categoryId) {
        const category = await tx.category.upsert({
          where: { name: categoryName },
          create: {
            legacyId: nextLegacyCategoryId++,
            name: categoryName,
            slug: `${slugify(categoryName)}-imported`,
            image: "/uploads/categories/default-category.jpg",
            showOnHome: false,
            sortOrder: categories.length + categoryIds.size,
          },
          update: {},
        });
        categoryId = category.id;
        categoryIds.set(categoryName.toLowerCase(), categoryId);
      }

      const price = Math.max(0, Number(legacy.price) || 0);
      const originalPrice = Number(legacy.originalPrice);
      const discountPercent =
        Number.isFinite(originalPrice) && originalPrice > price && originalPrice > 0
          ? Math.min(100, Math.round(((originalPrice - price) / originalPrice) * 100))
          : 0;
      const images = Array.isArray(legacy.images)
        ? legacy.images.map(String).filter(Boolean)
        : legacy.image
          ? [String(legacy.image)]
          : [];
      const createdAt = legacy.createdAt ? new Date(legacy.createdAt) : new Date();

      await tx.product.create({
        data: {
          id: `na-${Number(legacy.id)}`,
          legacyNewArrivalId: Number(legacy.id),
          name: String(legacy.name || "Product").trim(),
          description: String(legacy.description || ""),
          price,
          originalPrice:
            Number.isFinite(originalPrice) && originalPrice > price
              ? originalPrice
              : null,
          discountPercent,
          category: categoryName,
          categoryRecordId: categoryId,
          stock: Math.max(0, Number(legacy.stock ?? (legacy.inStock ? 1 : 0)) || 0),
          variants: [],
          listingImageUrls: images,
          isActive: true,
          isFeatured: legacy.isFeatured === true,
          createdAt: Number.isNaN(createdAt.valueOf()) ? new Date() : createdAt,
        },
      });
    }
  });

  console.log(`Imported ${categories.length} categories and ${products.length} products into MySQL.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
