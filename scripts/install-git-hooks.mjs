// Points Git at the versioned hooks in .githooks (runs on `npm install`).
// Never fails the install: it does nothing outside a Git work tree (for example on Hostinger)
// and never replaces a hooks path that someone configured on purpose.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const git = (...args) => spawnSync("git", args, { encoding: "utf8" });

try {
  if (!existsSync(".githooks") || git("rev-parse", "--is-inside-work-tree").stdout?.trim() !== "true") process.exit(0);
  const current = git("config", "--get", "core.hooksPath").stdout?.trim();
  if (current === ".githooks") process.exit(0);
  if (current) {
    console.warn(`[hooks] core.hooksPath is already "${current}"; leaving it. Add .githooks/pre-push there to enable the migration check.`);
    process.exit(0);
  }
  if (git("config", "core.hooksPath", ".githooks").status === 0) console.log("[hooks] Enabled the migration pre-push check (.githooks).");
} catch {
  // Optional developer convenience only.
}
