import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
assert.ok(process.env.DATABASE_URL && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL).hostname), "Local database required");

async function main() {
const { prisma } = await import("../lib/prisma");
const { publicServices } = await import("../lib/public-services");
const { giftProducts } = await import("../lib/gift-products");
const run = `marketplace-test-${randomUUID()}`;
const vendorIds: string[] = []; const serviceIds: string[] = []; const productIds: string[] = [];
try {
  const approved = await prisma.vendor.create({ data: { email: `${run}-approved@example.invalid`, ownerName: "Fixture Vendor", shopName: "Fixture Services", passwordHash: "fixture", address: "Test address", status: "approved" } });
  const pending = await prisma.vendor.create({ data: { email: `${run}-pending@example.invalid`, ownerName: "Fixture Vendor", shopName: "Pending Services", passwordHash: "fixture", address: "Test address", status: "pending" } });
  vendorIds.push(approved.id, pending.id);
  const input = { name: "Fixture AC Repair", description: "Fixture service", type: "Repair", price: 5000, cities: ["Lahore"], durationMinutes: 60, leadDays: 1, warranty: "", cancellationTerms: "Contact provider", active: true };
  const visible = await prisma.serviceOffering.create({ data: { ...input, vendorId: approved.id } });
  const hidden = await prisma.serviceOffering.create({ data: { ...input, name: "Fixture Hidden Repair", vendorId: approved.id, moderationStatus: "HIDDEN" } });
  const unapproved = await prisma.serviceOffering.create({ data: { ...input, name: "Fixture Pending Repair", vendorId: pending.id } });
  serviceIds.push(visible.id, hidden.id, unapproved.id);
  const services = await publicServices({ search: "Fixture", category: "Repair", city: "Lahore" });
  assert.ok(services.some(service => service.id === visible.id));
  assert.ok(!services.some(service => service.id === hidden.id || service.id === unapproved.id));
  assert.ok(!(await publicServices({ city: "Karachi" })).some(service => service.id === visible.id));
  console.log("PASS approved active services are public; hidden and unapproved services are excluded; city filter works");

  const gift = await prisma.product.create({ data: { name: "Fixture Birthday Gift Box", description: "Fixture", price: 1500, category: "Gifts", stock: 2, variants: [] } });
  const unrelated = await prisma.product.create({ data: { name: "Fixture Desk", description: "Fixture", price: 1500, category: "Furniture", stock: 2, variants: [] } });
  productIds.push(gift.id, unrelated.id);
  const gifts = await giftProducts({ search: "Fixture" });
  assert.ok(gifts.some(product => product._id === gift.id));
  assert.ok(!gifts.some(product => product._id === unrelated.id));
  console.log("PASS gift catalog includes matching real products and excludes unrelated products");
} finally {
  if (serviceIds.length) await prisma.serviceOffering.deleteMany({ where: { id: { in: serviceIds } } });
  if (productIds.length) await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  if (vendorIds.length) await prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
  await prisma.$disconnect();
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
