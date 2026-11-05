// Validate current source and isolated build types without deleting an unrelated dev build's stale generated types.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = process.cwd().replaceAll("\\", "/"), directory = path.join(root, "node_modules/.cache/joro-seo");
fs.mkdirSync(directory, { recursive: true });
const file = path.join(directory, "tsconfig.check.json");
const generated = path.join(root, "node_modules/.cache/joro-seo-build/types");
const generatedTypes = fs.existsSync(generated) ? fs.readdirSync(generated, { recursive: true }).filter(value => value.endsWith(".ts")).map(value => path.join(generated, value).replaceAll("\\", "/")) : [];
fs.writeFileSync(file, JSON.stringify({ extends: path.join(root, "tsconfig.json"), compilerOptions: { incremental: false },
  ...(generatedTypes.length ? { files: generatedTypes } : {}),
  include: [`${root}/**/*.ts`, `${root}/**/*.tsx`],
  exclude: [`${root}/node_modules`, `${root}/.next`, `${root}/.release-prep`],
}, null, 2));
process.exitCode = spawnSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", file], { stdio: "inherit" }).status ?? 1;
