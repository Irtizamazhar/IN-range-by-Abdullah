import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildSteps, migrationsRequested, runBuild } from "../scripts/lib/build-steps.mjs";

type Step = { label: string; tool: string; args: string[] };

function simulate(env: Record<string, string | undefined>, argv: string[] = [], failAt?: string) {
  const ran: string[] = [];
  const out: string[] = [];
  const code = runBuild({
    env,
    argv,
    run: (step: Step) => {
      ran.push(step.label);
      return step.label === failAt ? 1 : 0;
    },
    log: (line: string) => out.push(line),
    error: (line: string) => out.push(line),
  });
  return { code, ran, out: out.join("\n") };
}

const BUILD_ONLY = ["prisma generate", "next build"];
const DEPLOY = ["deployment preflight", "prisma migrate deploy", "prisma migrate status", ...BUILD_ONLY];

test("local build never touches a database unless explicitly enabled", () => {
  for (const value of [undefined, "", "  ", "false", "FALSE"]) {
    const result = simulate({ JORO_DEPLOY_MIGRATIONS: value, DATABASE_URL: "mysql://u:p@db.example:3306/x" });
    assert.equal(result.code, 0, String(value));
    assert.deepEqual(result.ran, BUILD_ONLY, String(value));
    assert.match(result.out, /migrations disabled/);
  }
});

test("deployment build runs preflight, migrate deploy and status before the Next.js build", () => {
  for (const env of [{ JORO_DEPLOY_MIGRATIONS: "true" }, { JORO_DEPLOY_MIGRATIONS: " TRUE " }]) {
    const result = simulate(env);
    assert.equal(result.code, 0);
    assert.deepEqual(result.ran, DEPLOY);
  }
  // npm run build:deploy keeps working without the flag.
  assert.deepEqual(simulate({}, ["--migrate"]).ran, DEPLOY);
});

test("a failing preflight stops the build before any migration or build step", () => {
  const result = simulate({ JORO_DEPLOY_MIGRATIONS: "true" }, [], "deployment preflight");
  assert.equal(result.code, 1);
  assert.deepEqual(result.ran, ["deployment preflight"]);
  assert.match(result.out, /deployment preflight failed .* later steps did not run/);
});

test("any failing deployment step stops the remaining steps", () => {
  assert.deepEqual(simulate({ JORO_DEPLOY_MIGRATIONS: "true" }, [], "prisma migrate deploy").ran, DEPLOY.slice(0, 2));
  assert.deepEqual(simulate({ JORO_DEPLOY_MIGRATIONS: "true" }, [], "prisma migrate status").ran, DEPLOY.slice(0, 3));
  assert.equal(simulate({ JORO_DEPLOY_MIGRATIONS: "true" }, [], "prisma migrate status").code, 1);
});

test("an unrecognised flag value stops the build instead of guessing", () => {
  for (const value of ["1", "yes", "on", "ture"]) {
    const result = simulate({ JORO_DEPLOY_MIGRATIONS: value });
    assert.equal(result.code, 1, value);
    assert.deepEqual(result.ran, [], value);
    assert.match(result.out, /must be "true" or "false"/);
  }
  assert.throws(() => migrationsRequested({ JORO_DEPLOY_MIGRATIONS: "1" }), /must be "true" or "false"/);
});

test("build steps only invoke node tools, never npm, so scripts cannot recurse", () => {
  for (const step of buildSteps({ migrate: true }) as Step[]) assert.ok(["db-migrations", "prisma", "next"].includes(step.tool));
  const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
  assert.equal(scripts.build, "node scripts/build.mjs");
  assert.equal(scripts["build:deploy"], "node scripts/build.mjs --migrate");
  assert.doesNotMatch(readFileSync("scripts/build.mjs", "utf8"), /["'`]npm/);
});

function runBuildScript(env: Record<string, string>) {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  delete childEnv.DATABASE_URL; // never let this test reach any database
  const res = spawnSync(process.execPath, ["scripts/build.mjs"], { env: childEnv, encoding: "utf8", timeout: 60_000 });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

test("real build script: preflight refusal stops the build before prisma migrate deploy", () => {
  const result = runBuildScript({ JORO_DEPLOY_MIGRATIONS: "true" });
  assert.equal(result.code, 1);
  assert.match(result.out, /DATABASE_URL is not set/);
  assert.match(result.out, /deployment preflight failed/);
  assert.doesNotMatch(result.out, /2\/5 prisma migrate deploy/);
});

test("real build script: an invalid flag stops before any step", () => {
  const result = runBuildScript({ JORO_DEPLOY_MIGRATIONS: "yes" });
  assert.equal(result.code, 1);
  assert.doesNotMatch(result.out, /1\/\d /);
});
