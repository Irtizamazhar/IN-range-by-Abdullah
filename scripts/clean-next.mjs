import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();

async function wipe(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) return;
  try {
    await rm(p, {
      recursive: true,
      force: true,
      maxRetries: 25,
      retryDelay: 150,
    });
    console.log("Removed:", rel);
    return;
  } catch (e) {
    console.warn("fs.rm retry failed:", e instanceof Error ? e.message : e);
  }
  if (process.platform === "win32") {
    try {
      execSync(`cmd /c rmdir /s /q "${p}"`, { stdio: "ignore" });
      console.log("Removed (rmdir):", rel);
    } catch {
      console.error(
        "Could not delete",
        rel,
        "— stop all `npm run dev` / Node processes, close VS Code terminals using this folder, then run: npm run clean"
      );
      process.exitCode = 1;
    }
  } else {
    process.exitCode = 1;
  }
}

const dirs = [".next", join("node_modules", ".cache"), ".turbo"];
for (const d of dirs) {
  await wipe(d);
}
if (!process.exitCode) {
  console.log("Clean OK. Now: npm run dev");
}
