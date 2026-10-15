import { build } from "esbuild";
import { createRequire } from "node:module";

const bundled = await build({
  entryPoints: ["tests/remember-me.test.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  write: false,
});
const require = createRequire(import.meta.url);
const testModule = { exports: {} };
new Function("module", "exports", "require", bundled.outputFiles[0].text)(testModule, testModule.exports, require);
