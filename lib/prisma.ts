import { PrismaClient } from "@prisma/client";

/**
 * Do not import `dotenv` here — Next.js loads `.env` / `.env.local` for the app, and
 * bundling `dotenv` into API routes breaks dev (`Cannot find module './vendor-chunks/dotenv.js'`).
 * Prisma CLI still reads `.env` from disk when you run `prisma` commands.
 */

/** Prisma schema uses env("DATABASE_URL"); the engine expects it on process.env. */
function ensureDatabaseUrlOnProcessEnv(): void {
  let url = process.env.DATABASE_URL?.trim();
  if (!url || url.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      url =
        "mysql://root:root@localhost:3306/inrange";
      console.warn(
        "[prisma] DATABASE_URL not set — using local dev default mysql://root:***@localhost:3306/inrange (set .env.local)"
      );
    }
  }
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Add it to .env or .env.local (see .env.example)."
    );
  }
  process.env.DATABASE_URL = url;
}

ensureDatabaseUrlOnProcessEnv();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
