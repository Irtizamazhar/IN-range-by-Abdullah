const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

prisma.vendor.findFirst({
  select: { id: true, suspendedAt: true, suspensionReason: true,
    suspendedBy: true, suspensionUntil: true, suspensionCount: true },
}).then(() => console.log("Vendor suspension schema: OK"))
  .catch((error) => {
    console.error("Vendor schema check failed:", error.code || "connection failure");
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
