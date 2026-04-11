import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Default commission tiers (spec). Upsert-safe for re-runs. */
const COMMISSION_ROWS: { categoryName: string; commissionPercentage: number }[] =
  [
    { categoryName: "Global", commissionPercentage: 10 },
    { categoryName: "Clothing", commissionPercentage: 8 },
    { categoryName: "Electronics", commissionPercentage: 5 },
    { categoryName: "Food", commissionPercentage: 15 },
    { categoryName: "Beauty", commissionPercentage: 12 },
    { categoryName: "Other", commissionPercentage: 10 },
  ];

async function main() {
  for (const row of COMMISSION_ROWS) {
    await prisma.commissionSetting.upsert({
      where: { categoryName: row.categoryName },
      create: {
        categoryName: row.categoryName,
        commissionPercentage: row.commissionPercentage,
      },
      update: {
        commissionPercentage: row.commissionPercentage,
      },
    });
  }
  console.log(
    "[prisma/seed] commission_settings:",
    COMMISSION_ROWS.length,
    "rows"
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
