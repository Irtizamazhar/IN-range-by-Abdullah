import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRawUnsafe("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'Want' AND COLUMN_NAME IN ('requestType', 'occasion')) OR (TABLE_NAME = 'ServiceOffering' AND COLUMN_NAME IN ('moderationStatus', 'moderationReason'))) ORDER BY TABLE_NAME, COLUMN_NAME");
  console.log(rows.map(row => `${row.TABLE_NAME}.${row.COLUMN_NAME}`).join(",") || "none");
} finally {
  await prisma.$disconnect();
}
