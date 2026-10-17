import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // Physical table names are the lowercase @@map names and are case-sensitive in production.
  const duplicates = await db.$queryRaw<Array<{ groups: bigint }>>`SELECT COUNT(*) AS \`groups\` FROM (SELECT customerId, productId FROM review WHERE customerId IS NOT NULL GROUP BY customerId, productId HAVING COUNT(*) > 1) duplicate_reviews`;
  const columns = await db.$queryRaw<Array<{ TABLE_NAME: string; COLUMN_NAME: string }>>`SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((BINARY TABLE_NAME = 'vendor' AND COLUMN_NAME IN ('storeSlug','storeBanner','serviceCities')) OR (BINARY TABLE_NAME = 'review' AND COLUMN_NAME IN ('updatedAt','withdrawn')))`;
  const tables = await db.$queryRaw<Array<{ TABLE_NAME: string }>>`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME IN ('storefollow','want','wantpost','wantoffer','wantofferlegacy20260914','wantreport','offerrevision','offerquote','shoppingroom','serviceoffering','orderservice','vendorpromotion','customernotification')`;
  // Legacy tables kept from the pre-merge schema exist only in older databases.
  const present = new Set(tables.map((table) => table.TABLE_NAME));
  const legacyCount = async (table: "wantpost" | "wantofferlegacy20260914") =>
    present.has(table) ? Number((await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*) AS n FROM \`${table}\``))[0]?.n || 0) : null;
  const legacyCounts = { wantPosts: await legacyCount("wantpost"), wantOffers: await legacyCount("wantofferlegacy20260914") };
  // Active history starts at 0_baseline; older names come from prisma/migrations_archive.
  const migrations = await db.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
  console.info(JSON.stringify({
    duplicateCustomerProductReviewGroups: Number(duplicates[0]?.groups || 0),
    existingNewColumns: columns,
    existingNewTables: tables,
    legacyRows: legacyCounts,
    baselineRecorded: migrations.some((migration) => migration.migration_name === "0_baseline"),
    appliedMigrations: migrations.map((migration) => migration.migration_name),
  }, null, 2));
  if (Number(duplicates[0]?.groups || 0)) { console.error("STOP: review duplicates require a preservation plan before adding uniqueness. No rows were changed."); process.exitCode = 2; }
}
main().catch(e => { console.error("Read-only database preflight failed:", e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());
