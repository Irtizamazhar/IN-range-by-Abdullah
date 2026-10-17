// CI guard: every database URL in the environment must point to a local throwaway service.
// Runs before any test or build so a misconfigured workflow cannot reach a real database.
const names = Object.keys(process.env).filter((k) => /DATABASE_URL|SERVER_URL$/.test(k));
const problems = [];
for (const name of names) {
  let url;
  try { url = new URL(process.env[name]); } catch { problems.push(`${name} is not a valid URL`); continue; }
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) problems.push(`${name} points to a non-local host`);
  if (/hstgr|hostinger/i.test(url.hostname) || /^\/?u\d+_/.test(url.pathname)) problems.push(`${name} looks like a production database`);
}
if (!names.length) problems.push("no database URLs are configured");
if (problems.length) {
  console.error(`Refusing to continue:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`OK: ${names.join(", ")} all point to local CI database services.`);
