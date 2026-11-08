import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { catalogFingerprint, planProductSlugs } from "../lib/product-slug-plan";
const db = new PrismaClient();
const args = process.argv.slice(2);
function option(name: string) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error("Missing value: " + name);
  return args[i + 1];
}
const query = { select: { id: true, name: true, slug: true, updatedAt: true }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] };
async function main() {
  const target = new URL(process.env.DATABASE_URL || "");
  const database = target.hostname + ":" + (target.port || "3306") + target.pathname;
  const applyFile = option("--apply-plan");
  if (args.includes("--apply")) throw new Error("Direct --apply disabled. Use a reviewed --apply-plan file.");
  if (applyFile) {
    if (option("--expect-database") !== database || !args.includes("--confirm-catalog-writes-paused")) throw new Error("Applying requires exact --expect-database host:port/database and --confirm-catalog-writes-paused.");
    const saved = JSON.parse(readFileSync(applyFile, "utf8"));
    if (saved.version !== 1 || saved.database !== database) throw new Error("Plan database/version mismatch.");
    await db.$transaction(async tx => {
      const rows = await tx.product.findMany(query);
      const assignments = planProductSlugs(rows);
      const original = new Map(rows.map(row => [row.id, row]));
      if (saved.fingerprint !== catalogFingerprint(rows) || JSON.stringify(saved.assignments) !== JSON.stringify(assignments)) throw new Error("Stale or modified plan. Generate and review a new plan.");
      for (const row of assignments) {
        const result = await tx.product.updateMany({ where: { id: row.id, slug: null }, data: { slug: row.slug, updatedAt: original.get(row.id)!.updatedAt } });
        if (result.count !== 1) throw new Error("Concurrent change; rolling back.");
      }
      const after = await tx.product.findMany(query);
      const expected = new Map(assignments.map(row => [row.id, row.slug]));
      if (after.length !== rows.length || after.some((row, i) => row.id !== rows[i].id || row.name !== rows[i].name || row.updatedAt.getTime() !== rows[i].updatedAt.getTime() || row.slug !== (expected.get(row.id) || rows[i].slug) || row.slug === null)) throw new Error("Coverage or identity verification failed.");
      planProductSlugs(after);
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 300_000 });
    console.log("Committed: every product has a unique valid slug; IDs and titles preserved.");
    return;
  }
  const rows = await db.product.findMany(query);
  const plan = { version: 1, database, fingerprint: catalogFingerprint(rows), products: rows.length, assignments: planProductSlugs(rows) };
  const output = option("--write-plan");
  if (output) writeFileSync(output, JSON.stringify(plan, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(plan, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Backfill failed"); process.exitCode = 1; }).finally(() => db.$disconnect());
