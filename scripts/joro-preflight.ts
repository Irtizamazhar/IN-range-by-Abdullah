import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const duplicates = await db.$queryRaw<Array<{ groups: bigint }>>`SELECT COUNT(*) AS \`groups\` FROM (SELECT customerId, productId FROM Review WHERE customerId IS NOT NULL GROUP BY customerId, productId HAVING COUNT(*) > 1) duplicate_reviews`;
  const columns = await db.$queryRaw<Array<{ TABLE_NAME: string; COLUMN_NAME: string }>>`SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'Vendor' AND COLUMN_NAME IN ('storeSlug','storeBanner','serviceCities')) OR (TABLE_NAME = 'Review' AND COLUMN_NAME IN ('updatedAt','withdrawn')))`;
  const tables = await db.$queryRaw<Array<{ TABLE_NAME: string }>>`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('StoreFollow','Want','WantOffer','OfferQuote','ShoppingRoom','ServiceOffering','OrderService','VendorPromotion','CustomerNotification')`;
  console.info(JSON.stringify({ duplicateCustomerProductReviewGroups: Number(duplicates[0]?.groups || 0), existingNewColumns: columns, existingNewTables: tables }, null, 2));
  if (Number(duplicates[0]?.groups || 0)) { console.error("STOP: review duplicates require a preservation plan before adding uniqueness. No rows were changed."); process.exitCode = 2; }
}
main().catch(e => { console.error("Read-only database preflight failed:", e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());