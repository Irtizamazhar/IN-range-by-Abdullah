#!/usr/bin/env bash
# Scenario tests for scripts/db-migrations.mjs (docs/DATABASE_MIGRATIONS.md).
# Uses a scratch copy of prisma/ under node_modules/.cache and one disposable database on the server
# named by MIGRATION_TEST_SERVER_URL (local hosts only, see db-url.mjs). The project's prisma/ folder,
# its Prisma Client and every other database are left untouched.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT" || exit 1
TMP="$(mktemp -d)"
FLOW="$ROOT/node_modules/.cache/joro-flow"; F="$FLOW/prisma"; SCH="$F/schema.prisma"; DB=joro_disposable_flow
CLIENT="$ROOT/node_modules/.cache/joro-test-client"
P="node $ROOT/node_modules/prisma/build/index.js"
fail=0
ok() { if [ "$1" = "$2" ]; then echo "    PASS: $3"; else echo "    FAIL: $3 (got '$1', expected '$2')"; fail=1; fi; }
url() { node "$HERE/db-url.mjs" "$1"; }
U="$(url $DB)" || exit 1
SERVER="$(url server)" || exit 1
mig() { DATABASE_URL="$U" node scripts/db-migrations.mjs migrate --schema "$SCH" "$@" > "$TMP/mig.out" 2>&1; local rc=$?; sed 's/^/      /' "$TMP/mig.out"; return $rc; }
chk() { node scripts/db-migrations.mjs check --schema "$SCH" "$@" > "$TMP/chk.out" 2>&1; local rc=$?; sed 's/^/      /' "$TMP/chk.out"; return $rc; }
q() { node "$HERE/query.mjs" $DB "$1"; }
sql() { echo "$1" | $P db execute --stdin --url "$U" >/dev/null 2>&1; }
ndirs() { ls "$F/migrations" | grep -vc migration_lock; }
# Replaces the last occurrence of $1 with $2 in the scratch schema (GiftCard is appended at the end).
edit() { node -e 'const fs=require("fs");const [f,a,b]=process.argv.slice(1);const t=fs.readFileSync(f,"utf8");const i=t.lastIndexOf(a);if(i<0){console.error("edit anchor missing: "+a);process.exit(1)}fs.writeFileSync(f,t.slice(0,i)+b+t.slice(i+a.length))' "$SCH" "$1" "$2"; }
append() { printf '%s\n' "$1" >> "$SCH"; }
col() { q "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$1' AND COLUMN_NAME='$2'"; }

rm -rf "$FLOW" "$CLIENT" && mkdir -p "$F" && cp -r prisma/migrations prisma/migration-manifest.json "$F/"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[2],fs.readFileSync(process.argv[1],"utf8").split("\r\n").join("\n"))' prisma/schema.prisma "$SCH"
edit 'provider = "prisma-client-js"' "provider = \"prisma-client-js\"
  output   = \"$CLIENT\""
echo "DROP DATABASE IF EXISTS $DB;" | $P db execute --stdin --url "$SERVER" >/dev/null 2>&1
echo "(scratch schema in node_modules/.cache/joro-flow; client in node_modules/.cache/joro-test-client)"
COMMITTED=$(ndirs)

echo; echo "=== 1. No schema change: committed migrations applied, nothing created"
mig; ok $? 0 "first run succeeds"; ok "$(ndirs)" "$COMMITTED" "no new migration folder"
mig; ok $? 0 "second run succeeds"; ok "$(grep -c 'No schema changes need a migration' "$TMP/mig.out")" 1 "reports no changes"; ok "$(ndirs)" "$COMMITTED" "still no new folder"

echo; echo "=== 2. New table: migration generated and applied"
append '
model GiftCard {
  id        String   @id @default(cuid())
  code      String?  @db.VarChar(40)
  createdAt DateTime @default(now())

  @@map("giftcard")
}'
mig; ok $? 0 "migrated"; ok "$(ls "$F/migrations" | grep -c '_add_giftcard_table$')" 1 "folder named *_add_giftcard_table"
ok "$(q "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='giftcard'")" 1 "giftcard table exists"
chk; ok $? 0 "check passes after migration"

echo; echo "=== 3. New optional column: migration generated and applied"
edit '  code      String?  @db.VarChar(40)' '  code      String?  @db.VarChar(40)
  note      String?  @db.VarChar(200)'
mig; ok $? 0 "migrated"; ok "$(ls "$F/migrations" | grep -c '_add_giftcard_note$')" 1 "folder named *_add_giftcard_note"; ok "$(col giftcard note)" 1 "column exists"

echo; echo "=== 4a. New index: applied automatically"
edit '  @@map("giftcard")' '  @@index([code])
  @@map("giftcard")'
mig; ok $? 0 "migrated"; ok "$(q "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='giftcard' AND INDEX_NAME='giftcard_code_idx'")" 1 "index exists"

echo; echo "=== 4b. New relation (foreign key on an existing table): generated, approval required, then applied"
edit '  note      String?  @db.VarChar(200)' '  note      String?  @db.VarChar(200)
  productId String?
  product   Product? @relation(fields: [productId], references: [id], onDelete: SetNull)'
edit '  offerRevisions     OfferRevision[]' '  offerRevisions     OfferRevision[]
  giftCards          GiftCard[]'
mig; ok $? 3 "stops awaiting approval (exit 3)"; ok "$(col giftcard productId)" 0 "nothing applied before approval"
ok "$(grep -c 'New foreign key on an existing table' "$TMP/mig.out")" 1 "reason shown"
mig; ok $? 3 "re-running without approval still stops"
mig --approve; ok $? 0 "approved and applied"; ok "$(col giftcard productId)" 1 "column applied"
ok "$(q "SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='giftcard'")" 1 "foreign key applied"

echo; echo "=== 4c. Enum value added: generated, approval required, then applied"
edit '  FIRE
}' '  FIRE
  CLAP
}'
mig; ok $? 3 "stops awaiting approval"; ok "$(grep -c 'enum values' "$TMP/mig.out")" 1 "explains the enum change"
mig --approve; ok $? 0 "approved and applied"
ok "$(q "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='wantreaction' AND COLUMN_NAME='type' AND COLUMN_TYPE LIKE '%CLAP%'")" 1 "enum has CLAP"

echo; echo "=== 5. Destructive change on a table with data: approval required, data kept, discard"
sql "INSERT INTO giftcard (id, code, note, createdAt) VALUES ('gc1','KEEP-ME','precious',NOW(3));"
before=$(ndirs)
edit '  note      String?  @db.VarChar(200)
' ''
mig; ok $? 3 "stops awaiting approval"; ok "$([ "$(grep -c '\[destructive\]' "$TMP/mig.out")" -ge 1 ] && echo yes)" yes "flagged destructive"
ok "$(q "SELECT note FROM giftcard WHERE id='gc1'")" precious "data still present"
mig --discard; ok $? 0 "discarded"; ok "$(ndirs)" "$before" "unapplied migration folder removed"
edit '  productId String?
  product   Product? @relation' '  note      String?  @db.VarChar(200)
  productId String?
  product   Product? @relation'
mig; ok $? 0 "schema restored: no change"; ok "$(ndirs)" "$before" "no migration created"

echo; echo "=== 6. Rapid changes: required column without default, then corrected before approval"
edit '  createdAt DateTime @default(now())
' '  pin       String   @db.VarChar(10)
  createdAt DateTime @default(now())
'
mig; ok $? 3 "required column on table with rows stops for approval"; ok "$([ "$(grep -c 'Required column without a default' "$TMP/mig.out")" -ge 1 ] && echo yes)" yes "reason shown"
edit '  pin       String   @db.VarChar(10)' '  pin       String   @default("0000") @db.VarChar(10)'
mig; ok $? 0 "changed schema regenerates the unapproved migration and applies the safe version"
ok "$(grep -c 'Discarded unapplied migration' "$TMP/mig.out")" 1 "stale unapproved migration replaced"
ok "$(q "SELECT pin FROM giftcard WHERE id='gc1'")" 0000 "existing row got the default"

echo; echo "=== 7. Drift: manual change outside Prisma is detected, nothing reset"
sql "ALTER TABLE giftcard ADD COLUMN hack INT NULL;"
mig; ok "$([ $? -eq 1 ] && echo stopped || echo ran)" stopped "stops on drift"; ok "$([ "$(grep -c 'Drift detected' "$TMP/mig.out")" -ge 1 ] && echo yes)" yes "drift reported"
ok "$(q "SELECT code FROM giftcard WHERE id='gc1'")" KEEP-ME "data intact, no reset"; ok "$(col giftcard hack)" 1 "manual column untouched"
sql "ALTER TABLE giftcard DROP COLUMN hack;"
mig; ok $? 0 "after reverting the manual change the cycle succeeds"

echo; echo "=== 8. Production protection"
DATABASE_URL="mysql://user:pw@srv1234.hstgr.io:3306/u749284283_inrange" node scripts/db-migrations.mjs migrate --schema "$SCH" > "$TMP/mig.out" 2>&1; ok $? 1 "remote host refused"; sed 's/^/      /' "$TMP/mig.out"
NODE_ENV=production DATABASE_URL="$U" node scripts/db-migrations.mjs migrate --schema "$SCH" > "$TMP/mig.out" 2>&1; ok $? 1 "NODE_ENV=production refused"; sed 's/^/      /' "$TMP/mig.out"
DATABASE_URL="mysql://user:pw@localhost:3306/u749284283_inrange" node scripts/db-migrations.mjs migrate --schema "$SCH" > "$TMP/mig.out" 2>&1; ok $? 1 "production database name refused"; sed 's/^/      /' "$TMP/mig.out"

echo; echo "=== 9. Concurrent runs are refused while another process holds the lock"
node -e 'require("fs").writeFileSync(process.argv[1], String(process.pid)); setTimeout(() => {}, 30000)' "$TMP/sleeper.pid" &
for _ in $(seq 1 50); do [ -s "$TMP/sleeper.pid" ] && break; sleep 0.2; done
SLEEPER_PID="$(cat "$TMP/sleeper.pid")"
mkdir -p node_modules/.cache/joro-migrations && printf '%s' "$SLEEPER_PID" > node_modules/.cache/joro-migrations/migrate.lock
mig; ok $? 1 "second process refused"; ok "$(grep -c 'Another migration process' "$TMP/mig.out")" 1 "clear message"
node -e 'try { process.kill(Number(process.argv[1])); } catch {}' "$SLEEPER_PID"; wait 2>/dev/null
mig; ok $? 0 "stale lock from a finished process is cleared"

echo; echo "=== 10. Missing-migration detection (static check)"
chk; ok $? 0 "check passes"
edit '  code      String?  @db.VarChar(40)' '  code      String?  @db.VarChar(41)'
chk; ok $? 1 "schema changed without migration: check fails"
edit '  code      String?  @db.VarChar(41)' '  code      String?  @db.VarChar(40)'
LAST=$(ls "$F/migrations" | grep -v migration_lock | tail -1); cp "$F/migrations/$LAST/migration.sql" "$TMP/last.sql"; echo "-- edited" >> "$F/migrations/$LAST/migration.sql"
chk; ok $? 1 "edited migration: check fails"; cp "$TMP/last.sql" "$F/migrations/$LAST/migration.sql"
mv "$F/migrations/$LAST" "$TMP/hidden-migration"
chk; ok $? 1 "missing migration folder: check fails"; mv "$TMP/hidden-migration" "$F/migrations/$LAST"
chk; ok $? 0 "restored: check passes"

echo; echo "=== 11. Failing migration stops the deployment chain before the build"
mkdir -p "$F/migrations/20991231000000_broken" && echo 'ALTER TABLE `does_not_exist` ADD COLUMN `x` INT NULL;' > "$F/migrations/20991231000000_broken/migration.sql"
node --input-type=module -e '
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const [root, dir] = process.argv.slice(1);
const { buildManifest } = await import(pathToFileURL(`${root}/scripts/lib/migration-tools.mjs`).href);
const migrations = readdirSync(`${dir}/migrations`).filter((n) => n !== "migration_lock.toml").sort()
  .map((name) => ({ name, sql: readFileSync(`${dir}/migrations/${name}/migration.sql`, "utf8") }));
writeFileSync(`${dir}/migration-manifest.json`, JSON.stringify(buildManifest(readFileSync(`${dir}/schema.prisma`, "utf8"), migrations), null, 2) + "\n");
' "$ROOT" "$F"
( DATABASE_URL="$U" node scripts/db-migrations.mjs deploy-preflight --schema "$SCH" && DATABASE_URL="$U" $P migrate deploy --schema "$SCH" && DATABASE_URL="$U" $P migrate status --schema "$SCH" && echo "BUILD WOULD RUN" ) > "$TMP/deploy.out" 2>&1; rc=$?
grep -E 'preflight passed|Applying migration|P3018|Database error|BUILD WOULD RUN' "$TMP/deploy.out" | sed 's/^/      /'
ok "$([ $rc -ne 0 ] && echo stopped || echo continued)" stopped "deployment chain stops"; ok "$(grep -c 'BUILD WOULD RUN' "$TMP/deploy.out")" 0 "build step never reached"
( DATABASE_URL="$U" node scripts/db-migrations.mjs deploy-preflight --schema "$SCH" && DATABASE_URL="$U" $P migrate deploy --schema "$SCH" ) > "$TMP/deploy.out" 2>&1; ok "$(grep -c 'P3009' "$TMP/deploy.out")" 1 "next deployment blocked until recovery (P3009)"
env -u DATABASE_URL node scripts/db-migrations.mjs deploy-preflight --schema "$SCH" > "$TMP/deploy.out" 2>&1; ok $? 1 "missing DATABASE_URL stops deployment"; sed 's/^/      /' "$TMP/deploy.out"

echo; echo "=== cleanup"
echo "DROP DATABASE IF EXISTS $DB;" | $P db execute --stdin --url "$SERVER" >/dev/null 2>&1 && echo "  dropped $DB"
rm -rf "$TMP" "$CLIENT" "$FLOW"
echo; [ $fail -eq 0 ] && echo "ALL SCENARIOS PASSED" || echo "SOME SCENARIOS FAILED"
exit $fail
