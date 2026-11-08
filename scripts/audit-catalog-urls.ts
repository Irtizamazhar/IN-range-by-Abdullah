import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const columns = await db.$queryRaw<{ COLUMN_NAME: string }[]>`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product' AND COLUMN_NAME = 'slug'`;
  const indexes = await db.$queryRaw<{ INDEX_NAME: string; NON_UNIQUE: number | bigint }[]>`SELECT INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product' AND COLUMN_NAME = 'slug'`;
  const eligible: Prisma.ProductWhereInput = { isActive: true, OR: [{ vendorPublication: { is: null } }, { vendorPublication: { is: { status: "active", vendor: { status: "approved" } } } }] };
  const categories = await db.category.findMany({ where: { isActive: true, products: { some: eligible } }, select: { name: true, slug: true, showOnHome: true } });
  const products = await db.product.findMany({ where: eligible, take: 3, select: { id: true, name: true } });
  const totalProducts = await db.product.count();
  const missingSlugs = columns.length ? await db.product.count({ where: { slug: null } }) : totalProducts;
  console.log(JSON.stringify({ slugColumnExists: columns.length > 0, slugUniqueIndexExists: indexes.some(index => Number(index.NON_UNIQUE) === 0), totalProducts, missingSlugs, eligibleCategoryCount: categories.length, homeFlagCount: categories.filter(c => c.showOnHome).length, categories, products }, null, 2));
}
main().catch(() => { console.error("Catalog audit failed: database unavailable. No writes attempted."); process.exitCode = 1; }).finally(() => db.$disconnect());
