// Isolated verification output; no database migration or production database connection.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const filename = "tsconfig.json", before = fs.readFileSync(filename);
const config = JSON.parse(before);
// Old dev-generated types reference routes removed before this task; do not delete that dev build.
config.include = config.include.filter(value => !value.startsWith(".next/types/"));
fs.writeFileSync(filename, JSON.stringify(config, null, 2) + "\n");
try {
  const result = spawnSync(process.execPath, ["scripts/build.mjs"], { stdio: "inherit", env: { ...process.env,
    JORO_DEPLOY_MIGRATIONS: "false", JORO_NEXT_DIST_DIR: "node_modules/.cache/joro-seo-build",
    DATABASE_URL: "mysql://seo_build:seo_build@127.0.0.1:9/seo_build", MAINTENANCE_MODE: "false",
  } });
  process.exitCode = result.status ?? 1;
} finally {
  const after = JSON.parse(fs.readFileSync(filename));
  after.include = after.include.filter(value => value !== "node_modules/.cache/joro-seo-build/types/**/*.ts");
  if (JSON.stringify(after) === JSON.stringify(config)) fs.writeFileSync(filename, before);
  else throw new Error("tsconfig was independently edited; automatic restoration stopped for review.");
}
