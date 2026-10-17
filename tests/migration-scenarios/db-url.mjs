// Prints a connection URL for a disposable test database. Used by the migration scenario tests.
//   node tests/migration-scenarios/db-url.mjs <joro_disposable_name | server>
// MIGRATION_TEST_SERVER_URL (for example mysql://root:pw@127.0.0.1:3306) must point to a local server.
// Refuses any other host and any database name not starting with joro_disposable_, so the tests can
// never reach a developer database or production.
const server = process.env.MIGRATION_TEST_SERVER_URL;
const name = process.argv[2] || "";
const fail = (msg) => { console.error(`[db-url] refused: ${msg}`); process.exit(1); };

if (!server) fail("MIGRATION_TEST_SERVER_URL is not set.");
let url;
try { url = new URL(server); } catch { fail("MIGRATION_TEST_SERVER_URL is not a valid URL."); }
if (url.protocol !== "mysql:") fail("MIGRATION_TEST_SERVER_URL must use mysql://.");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) fail(`host "${url.hostname}" is not local.`);
if (name !== "server" && !/^joro_disposable_[a-z0-9_]+$/.test(name)) fail("database name must match joro_disposable_*.");
url.pathname = name === "server" ? "/" : `/${name}`;
process.stdout.write(url.toString());
