import { Prisma } from "@prisma/client";
export function serviceAmounts(unitPrice: Prisma.Decimal, quantity: number, rate: Prisma.Decimal) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || unitPrice.lt(0) || rate.lt(0) || rate.gt(100)) throw new Error("Invalid service financial terms.");
  const gross = unitPrice.mul(quantity).toDecimalPlaces(2); const commission = gross.mul(rate).div(100).toDecimalPlaces(2);
  return { gross, commission, payable: gross.sub(commission) };
}