// Runs one read query against a disposable test database and prints rows tab-separated.
//   node tests/migration-scenarios/query.mjs <joro_disposable_name | server> "<SQL>"
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import prismaClient from "@prisma/client";

const helper = fileURLToPath(new URL("./db-url.mjs", import.meta.url));
const url = execFileSync(process.execPath, [helper, process.argv[2]], { env: process.env }).toString();
const db = new prismaClient.PrismaClient({ datasourceUrl: url });
try {
  for (const row of await db.$queryRawUnsafe(process.argv[3]))
    console.log(Object.values(row).map((v) => (typeof v === "bigint" ? v.toString() : v)).join("\t"));
} catch (e) {
  console.error("query failed:", e.message.split("\n").slice(-2).join(" "));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
