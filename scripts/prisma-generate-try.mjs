import { execSync } from "node:child_process";

try {
  execSync("npx prisma generate", { stdio: "inherit" });
} catch {
  console.warn(
    "\n[postinstall] prisma generate failed (Windows: stop `npm run dev` if EPERM on query_engine). Then run: npx prisma generate\n"
  );
}
