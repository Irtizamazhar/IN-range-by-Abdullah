#!/usr/bin/env bash
# Rehearses the production deployment chain (npm run build:deploy without the Next.js build) on a
# production-shaped disposable database built from the committed migrations. No real data is used.
# MIGRATION_TEST_SERVER_URL must name a local server; production uses MariaDB 11.8 with
# lower_case_table_names=0, which the CI MariaDB service matches.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT" || exit 1
P="node $ROOT/node_modules/prisma/build/index.js"
fail=0
ok() { if [ "$1" = "$2" ]; then echo "    PASS: $3"; else echo "    FAIL: $3 (got '$1', expected '$2')"; fail=1; fi; }
url() { node "$HERE/db-url.mjs" "$1"; }
SERVER="$(url server)" || exit 1
q() { node "$HERE/query.mjs" "$DB" "$1"; }
exec_sql() { echo "$1" | $P db execute --stdin --url "$(url "$DB")" > /dev/null; }
chain() {
  ( DATABASE_URL="$(url "$DB")" node scripts/db-migrations.mjs deploy-preflight \
    && DATABASE_URL="$(url "$DB")" $P migrate deploy \
    && DATABASE_URL="$(url "$DB")" $P migrate status \
    && echo "==> next step would be: npm run build" ) 2>&1 | grep -vE 'deprecated|pris\.ly|^\s*$|Environment variables|Prisma schema loaded|^\s+20[0-9]{12}_|not found locally' | sed 's/^/      /'
  return "${PIPESTATUS[0]}"
}
recreate() { echo "DROP DATABASE IF EXISTS \`$1\`; CREATE DATABASE \`$1\`;" | $P db execute --stdin --url "$SERVER" > /dev/null; }
BASELINE_SUM="$(node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' prisma/migrations/0_baseline/migration.sql)"

echo "server: $(node "$HERE/query.mjs" server "SELECT CONCAT(@@version, ', lower_case_table_names=', @@lower_case_table_names)")"

echo; echo "=== Production-shaped database: existing tables, legacy tables, archived history, no wantreport"
DB=joro_disposable_prodshape
recreate "$DB"
$P db execute --file prisma/migrations/0_baseline/migration.sql --url "$(url "$DB")" > /dev/null || { echo "baseline SQL failed"; exit 1; }
exec_sql "DROP TABLE \`wantreport\`;
CREATE TABLE \`wantpost\` (\`id\` VARCHAR(191) NOT NULL, \`customerId\` VARCHAR(191) NOT NULL, \`title\` VARCHAR(200) NOT NULL, PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE \`wantofferlegacy20260914\` (\`id\` VARCHAR(191) NOT NULL, \`wantId\` VARCHAR(191) NOT NULL, \`amount\` DECIMAL(12,2) NOT NULL, PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO \`wantpost\` VALUES ('wp1', 'c1', 'legacy want');
INSERT INTO \`wantofferlegacy20260914\` VALUES ('wo1', 'wp1', 1500.00);
CREATE TABLE \`_prisma_migrations\` (\`id\` VARCHAR(36) NOT NULL, \`checksum\` VARCHAR(64) NOT NULL, \`finished_at\` DATETIME(3) NULL, \`migration_name\` VARCHAR(255) NOT NULL, \`logs\` TEXT NULL, \`rolled_back_at\` DATETIME(3) NULL, \`started_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`applied_steps_count\` INTEGER UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
for name in $(ls prisma/migrations_archive | head -24); do
  exec_sql "INSERT INTO \`_prisma_migrations\` (\`id\`, \`checksum\`, \`finished_at\`, \`migration_name\`, \`started_at\`, \`applied_steps_count\`) VALUES (UUID(), REPEAT('0', 64), NOW(3), '$name', NOW(3), 1);"
done
TABLES_BEFORE="$(q "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")"
echo "    tables: $TABLES_BEFORE, history rows: $(q "SELECT COUNT(*) FROM _prisma_migrations")"

echo; echo "=== A. Deploy chain before the baseline row is recorded: must stop before any database change"
chain; ok "$([ $? -ne 0 ] && echo stopped || echo ran)" stopped "chain stops at the preflight"
ok "$(q "SELECT COUNT(*) FROM _prisma_migrations")" 24 "history unchanged"
ok "$(q "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL")" 0 "no failed history row created"

echo; echo "=== B. Baseline row recorded (runbook step 6), then the deploy chain"
exec_sql "INSERT INTO \`_prisma_migrations\` (\`id\`, \`checksum\`, \`finished_at\`, \`migration_name\`, \`logs\`, \`rolled_back_at\`, \`started_at\`, \`applied_steps_count\`) VALUES (UUID(), '$BASELINE_SUM', NOW(3), '0_baseline', NULL, NULL, NOW(3), 0);"
chain; ok $? 0 "chain succeeds and applies the pending migration"
ok "$(q "SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND BINARY TABLE_NAME='wantreport'")" 3 "wantreport created with its 3 foreign keys"
ok "$(q "SELECT CONCAT((SELECT COUNT(*) FROM wantpost), '/', (SELECT COUNT(*) FROM wantofferlegacy20260914))")" 1/1 "legacy tables and rows intact"

echo; echo "=== C. Next deployment with no pending migrations"
chain; ok $? 0 "chain succeeds with no pending migrations"
ok "$(q "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")" "$((TABLES_BEFORE + 1))" "only wantreport was added"

echo; echo "=== D. Fresh empty database"
DB=joro_disposable_fresh
recreate "$DB"
chain; ok $? 0 "chain creates the full schema on an empty database"
ok "$(q "SELECT COUNT(*) FROM servicecommissionrange")" 6 "default commission ranges seeded"

echo; echo "=== cleanup"
echo 'DROP DATABASE IF EXISTS `joro_disposable_prodshape`; DROP DATABASE IF EXISTS `joro_disposable_fresh`;' | $P db execute --stdin --url "$SERVER" > /dev/null && echo "  dropped test databases"
echo; [ $fail -eq 0 ] && echo "ALL DEPLOY REHEARSAL CHECKS PASSED" || echo "SOME DEPLOY REHEARSAL CHECKS FAILED"
exit $fail
