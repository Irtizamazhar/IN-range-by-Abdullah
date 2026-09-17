/**
 * Manual local-only fixture: one Customer, one Vendor (approved, dummy KYC-complete) and one
 * super_admin AdminUser for hand-testing all three roles. Never runs automatically; requires
 * ALLOW_LOCAL_TEST_SEED=true and a local database. Idempotent: upserts by email, so rerunning
 * always leaves exactly one of each account.
 *
 * Usage: npx tsx scripts/seed-local-test-users.ts
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { imageExtension } from "../lib/security/image-signature";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run: NODE_ENV is production.");
  process.exit(1);
}
if (process.env.ALLOW_LOCAL_TEST_SEED !== "true") {
  console.error("Refusing to run: set ALLOW_LOCAL_TEST_SEED=true to confirm this is a local, non-production database.");
  process.exit(1);
}
const dbUrl = process.env.DATABASE_URL || "";
let dbHost = "";
try { dbHost = new URL(dbUrl).hostname; } catch { /* validated below */ }
if (!["localhost", "127.0.0.1", "[::1]"].includes(dbHost)) {
  console.error("Refusing to run: DATABASE_URL must point at a local database (localhost/127.0.0.1).");
  process.exit(1);
}
const { LOCAL_TEST_CUSTOMER_PASSWORD, LOCAL_TEST_VENDOR_PASSWORD, LOCAL_TEST_ADMIN_PASSWORD } = process.env;
for (const [name, value] of [
  ["LOCAL_TEST_CUSTOMER_PASSWORD", LOCAL_TEST_CUSTOMER_PASSWORD],
  ["LOCAL_TEST_VENDOR_PASSWORD", LOCAL_TEST_VENDOR_PASSWORD],
  ["LOCAL_TEST_ADMIN_PASSWORD", LOCAL_TEST_ADMIN_PASSWORD],
] as const) {
  if (!value || value.length < 8) {
    console.error(`Refusing to run: set ${name} in .env.local to a password of at least 8 characters.`);
    process.exit(1);
  }
}

const CUSTOMER_EMAIL = "customer.test@joro.local";
const VENDOR_EMAIL = "vendor.test@joro.local";
const ADMIN_EMAIL_TEST = "admin.test@joro.local";
const STORE_SLUG = "joro-test-store";

// 1x1 PNG, used only as a non-real placeholder KYC image through the same private storage path
// real vendor documents use (storage/private/vendor-docs/<vendorId>/...), never a real document.
const FIXTURE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRsAAAAASUVORK5CYII=",
  "base64"
);

async function main() {
  const prisma = new PrismaClient();
  try {
    const customerHash = await bcrypt.hash(LOCAL_TEST_CUSTOMER_PASSWORD!, 12);
    const customer = await prisma.customer.upsert({
      where: { email: CUSTOMER_EMAIL },
      update: { passwordHash: customerHash, name: "JORO Test Customer", isActive: true },
      create: { email: CUSTOMER_EMAIL, passwordHash: customerHash, name: "JORO Test Customer", phone: "0300-0000000", isActive: true },
    });
    console.log(`Customer ready: ${customer.email} (${customer.id})`);

    const vendorHash = await bcrypt.hash(LOCAL_TEST_VENDOR_PASSWORD!, 12);
    const vendorData = {
      passwordHash: vendorHash,
      ownerName: "JORO Test Seller",
      shopName: "JORO Test Store",
      phone: "0300-0000001",
      // Fixture-only, never a real CNIC/IBAN.
      cnic: "00000-0000000-0",
      address: "House 1, Test Street, Test Town",
      city: "Lahore",
      businessType: "individual" as const,
      bankName: "Test Bank",
      accountNumber: "0000000000000",
      accountTitle: "JORO Test Seller",
      status: "approved" as const,
      isEmailVerified: true,
      primaryCategory: "Electronics",
      shopDescription: "Local test fixture store used only for manual QA. Not a real seller.",
      storeSlug: STORE_SLUG,
      onboardingSubmittedAt: new Date(),
      onboardingData: {
        step: 4,
        declarationAcceptedAt: new Date().toISOString(),
        businessLegalName: "",
        taxNumber: "",
        province: "Punjab",
        postalCode: "54000",
        pickupAddress: "House 1, Test Street, Test Town",
        pickupCity: "Lahore",
        pickupProvince: "Punjab",
        pickupPostalCode: "54000",
        pickupContactName: "JORO Test Seller",
        pickupPhone: "0300-0000001",
        returnSameAsPickup: true,
      },
    };
    const vendor = await prisma.vendor.upsert({
      where: { email: VENDOR_EMAIL },
      update: vendorData,
      create: { email: VENDOR_EMAIL, ...vendorData },
    });
    console.log(`Vendor ready: ${vendor.email} (${vendor.id}), store slug /stores/${vendor.storeSlug}`);

    for (const documentType of ["cnic_front", "cnic_back"] as const) {
      const existing = await prisma.vendorDocument.findFirst({ where: { vendorId: vendor.id, documentType } });
      if (existing) continue;
      if (!imageExtension(FIXTURE_PNG, "image/png")) throw new Error("Fixture image failed signature validation.");
      const dir = path.join(process.cwd(), "storage", "private", "vendor-docs", vendor.id);
      await fs.mkdir(dir, { recursive: true });
      const fileName = `${documentType}-fixture.png`;
      await fs.writeFile(path.join(dir, fileName), FIXTURE_PNG);
      await prisma.vendorDocument.create({
        data: { vendorId: vendor.id, documentType, fileUrl: `vendor-docs/${vendor.id}/${fileName}` },
      });
      console.log(`  fixture document stored: ${documentType}`);
    }

    const adminHash = await bcrypt.hash(LOCAL_TEST_ADMIN_PASSWORD!, 12);
    const admin = await prisma.adminUser.upsert({
      where: { email: ADMIN_EMAIL_TEST },
      update: { passwordHash: adminHash, name: "JORO Test Admin", role: "super_admin", permissions: ["*"], isActive: true },
      create: { email: ADMIN_EMAIL_TEST, passwordHash: adminHash, name: "JORO Test Admin", role: "super_admin", permissions: ["*"], isActive: true },
    });
    console.log(`Admin ready: ${admin.email} (${admin.id}), role ${admin.role}`);

    const [customerCount, vendorCount, adminCount] = await Promise.all([
      prisma.customer.count({ where: { email: CUSTOMER_EMAIL } }),
      prisma.vendor.count({ where: { email: VENDOR_EMAIL } }),
      prisma.adminUser.count({ where: { email: ADMIN_EMAIL_TEST } }),
    ]);
    if (customerCount !== 1 || vendorCount !== 1 || adminCount !== 1) {
      throw new Error(`Idempotency check failed: customer=${customerCount} vendor=${vendorCount} admin=${adminCount}`);
    }
    console.log("\nLocal test accounts ready (exactly one of each). Passwords are read only from env — not printed here.");
    console.log(`  Customer: ${CUSTOMER_EMAIL}`);
    console.log(`  Vendor:   ${VENDOR_EMAIL}  (store: ${STORE_SLUG})`);
    console.log(`  Admin:    ${ADMIN_EMAIL_TEST}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
