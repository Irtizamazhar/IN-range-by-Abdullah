import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { calculateHandlingFee } from "../lib/handling-fee";

function fakeDb(rates: Record<string, number>) {
  return {
    commissionSetting: {
      findUnique: async ({ where }: { where: { categoryName: string } }) =>
        where.categoryName in rates
          ? { commissionPercentage: new Prisma.Decimal(rates[where.categoryName]!) }
          : null,
    },
  } as unknown as Parameters<typeof calculateHandlingFee>[0];
}

test("handling fee is calculated per line from each category's rate", async () => {
  const db = fakeDb({ "Wardrobe and Organizers": 10, "Health & Beauty": 2, Global: 10 });
  const fee = await calculateHandlingFee(db, [
    { category: "Wardrobe and Organizers", vendorSpecialCommissionRate: null, baseCents: 200000 },
    { category: "Health & Beauty", vendorSpecialCommissionRate: null, baseCents: 100000 },
  ]);
  assert.deepEqual(fee.lines.map((l) => l.feeCents), [20000, 2000]);
  assert.equal(fee.totalCents, 22000);
});

test("vendor override wins; unknown categories fall back to Other then Global", async () => {
  const db = fakeDb({ Clothing: 8, Other: 12, Global: 10 });
  const fee = await calculateHandlingFee(db, [
    { category: "Clothing", vendorSpecialCommissionRate: new Prisma.Decimal(5), baseCents: 100000 },
    { category: "Unmapped", vendorSpecialCommissionRate: null, baseCents: 100000 },
  ]);
  assert.deepEqual(fee.lines.map((l) => l.rate), [5, 12]);
  assert.equal(fee.totalCents, 5000 + 12000);
  const globalOnly = await calculateHandlingFee(fakeDb({ Global: 10 }), [{ category: "Unmapped", vendorSpecialCommissionRate: null, baseCents: 423400 }]);
  assert.equal(globalOnly.totalCents, 42340);
});

test("fees round to the nearest paisa and ignore non-positive bases", async () => {
  const db = fakeDb({ Food: 7.5 });
  const fee = await calculateHandlingFee(db, [
    { category: "Food", vendorSpecialCommissionRate: null, baseCents: 3003 },
    { category: "Food", vendorSpecialCommissionRate: null, baseCents: 0 },
  ]);
  assert.equal(fee.totalCents, 225);
});
