import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const duplicates = await db.$queryRaw<Array<{ groups: bigint }>>`SELECT COUNT(*) AS \`groups\` FROM (SELECT customerId, productId FROM Review WHERE customerId IS NOT NULL GROUP BY customerId, productId HAVING COUNT(*) > 1) duplicate_reviews`;
  const columns = await db.$queryRaw<Array<{ TABLE_NAME: string; COLUMN_NAME: string }>>`SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'Vendor' AND COLUMN_NAME IN ('storeSlug','storeBanner','serviceCities')) OR (TABLE_NAME = 'Review' AND COLUMN_NAME IN ('updatedAt','withdrawn')))`;
  const tables = await db.$queryRaw<Array<{ TABLE_NAME: string }>>`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('StoreFollow','Want','WantPost','WantOffer','OfferRevision','OfferQuote','ShoppingRoom','ServiceOffering','OrderService','VendorPromotion','CustomerNotification')`;
  const legacyCounts = await db.$queryRaw<Array<{ wantPosts: bigint; wantOffers: bigint }>>`SELECT (SELECT COUNT(*) FROM WantPost) AS wantPosts, (SELECT COUNT(*) FROM WantOffer) AS wantOffers`;
  const migrations = await db.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
  console.info(JSON.stringify({
    duplicateCustomerProductReviewGroups: Number(duplicates[0]?.groups || 0),
    existingNewColumns: columns,
    existingNewTables: tables,
    legacyRows: {
      wantPosts: Number(legacyCounts[0]?.wantPosts || 0),
      wantOffers: Number(legacyCounts[0]?.wantOffers || 0),
    },
    appliedMigrations: migrations.map((migration) => migration.migration_name),
  }, null, 2));
  if (Number(duplicates[0]?.groups || 0)) { console.error("STOP: review duplicates require a preservation plan before adding uniqueness. No rows were changed."); process.exitCode = 2; }
}
main().catch(e => { console.error("Read-only database preflight failed:", e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());
