#!/usr/bin/env node
// npm run build (and npm run build:deploy = --migrate). The plan and its safety rules live in
// scripts/lib/build-steps.mjs; see docs/DATABASE_MIGRATIONS.md for the Hostinger setting.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBuild } from "./lib/build-steps.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = {
  "db-migrations": join(ROOT, "scripts", "db-migrations.mjs"),
  prisma: join(ROOT, "node_modules", "prisma", "build", "index.js"),
  next: join(ROOT, "node_modules", "next", "dist", "bin", "next"),
};

process.exitCode = runBuild({
  env: process.env,
  argv: process.argv.slice(2),
  run: (step) => {
    const res = spawnSync(process.execPath, [TOOLS[step.tool], ...step.args], { cwd: ROOT, stdio: "inherit", env: process.env });
    if (res.error) console.error(`[build] ${res.error.message}`);
    return res.status ?? 1;
  },
});
