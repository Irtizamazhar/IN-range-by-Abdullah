// Production build plan shared by scripts/build.mjs and its tests. See docs/DATABASE_MIGRATIONS.md.
//
// Hostinger only offers `npm run build` as the build command, so production migrations are opt-in:
//   JORO_DEPLOY_MIGRATIONS=true   deploy-preflight -> prisma migrate deploy -> prisma migrate status
//                                 -> prisma generate -> next build
//   unset / "false"               prisma generate -> next build (never touches a database)
// Only the real process environment is read. A value in .env or .env.local never enables migrations.

export const DEPLOY_MIGRATIONS_FLAG = "JORO_DEPLOY_MIGRATIONS";

export class BuildConfigError extends Error {}

/** `--migrate` (npm run build:deploy) or JORO_DEPLOY_MIGRATIONS=true. Any other value stops the build. */
export function migrationsRequested(env, argv = []) {
  if (argv.includes("--migrate")) return true;
  const raw = env[DEPLOY_MIGRATIONS_FLAG];
  if (raw === undefined || raw.trim() === "") return false;
  const value = raw.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  // A typo must not silently skip (or silently run) production migrations.
  throw new BuildConfigError(`${DEPLOY_MIGRATIONS_FLAG} must be "true" or "false". Build stopped before any database change.`);
}

/** Each step runs the named tool with `node`; npm is never invoked, so scripts cannot recurse. */
export function buildSteps({ migrate }) {
  const build = [
    { label: "prisma generate", tool: "prisma", args: ["generate"] },
    { label: "next build", tool: "next", args: ["build"] },
  ];
  if (!migrate) return build;
  return [
    { label: "deployment preflight", tool: "db-migrations", args: ["deploy-preflight"] },
    { label: "prisma migrate deploy", tool: "prisma", args: ["migrate", "deploy"] },
    { label: "prisma migrate status", tool: "prisma", args: ["migrate", "status"] },
    ...build,
  ];
}

/**
 * Runs the plan in order and stops at the first failing step.
 * `run(step)` returns the step's exit code. Returns the exit code for the whole build.
 * @param {{ env: Record<string, string | undefined>, argv?: string[], run: (step: { label: string, tool: string, args: string[] }) => number, log?: (line: string) => void, error?: (line: string) => void }} options
 */
export function runBuild({ env, argv = [], run, log = console.log, error = console.error }) {
  let migrate;
  try {
    migrate = migrationsRequested(env, argv);
  } catch (e) {
    if (!(e instanceof BuildConfigError)) throw e;
    error(`[build] ${e.message}`);
    return 1;
  }
  log(migrate
    ? `[build] Production migrations enabled (${argv.includes("--migrate") ? "--migrate" : `${DEPLOY_MIGRATIONS_FLAG}=true`}).`
    : `[build] Production migrations disabled; this build does not touch a database.`);
  const steps = buildSteps({ migrate });
  for (const [index, step] of steps.entries()) {
    log(`[build] ${index + 1}/${steps.length} ${step.label}`);
    const code = run(step);
    if (code !== 0) {
      error(`[build] ${step.label} failed (exit ${code}). Build stopped; later steps did not run.`);
      return code || 1;
    }
  }
  return 0;
}
