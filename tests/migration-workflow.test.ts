import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import {
  analyzeMigrationSql, assertDevelopmentDatabase, buildManifest, checkManifest, checkMigrationLayout,
  isEmptyMigration, schemaFingerprint, suggestMigrationName,
} from "../scripts/lib/migration-tools.mjs";

const lock = 'provider = "mysql"\n';
const levels = (sql: string) => analyzeMigrationSql(sql).map((r: { level: string }) => r.level);

test("schema fingerprint ignores comments and formatting but not database changes", () => {
  const base = 'model A {\n  id String @id\n  url String @default("https://joro.pk") // comment\n}\n';
  assert.equal(schemaFingerprint(base), schemaFingerprint("/// doc\nmodel   A {\r\n id    String @id\n\n url String @default(\"https://joro.pk\")\n}"));
  assert.notEqual(schemaFingerprint(base), schemaFingerprint(base.replace("url String", "url String?")));
  assert.notEqual(schemaFingerprint(base), schemaFingerprint(base.replace("https://joro.pk", "https://joro.pk/x")));
});

test("migration layout rejects bad names, duplicate timestamps, empty files and a missing lock", () => {
  assert.deepEqual(checkMigrationLayout({ lockText: lock, migrations: [{ name: "0_baseline", sql: "CREATE TABLE `a` (`id` INT);" }, { name: "20261020101010_add_x", sql: "SELECT 1;" }] }), []);
  const errors = checkMigrationLayout({
    lockText: null,
    migrations: [{ name: "20261020101010_a", sql: "x" }, { name: "20261020101010_b", sql: "x" }, { name: "Add-Thing", sql: "x" }, { name: "20261020101011_c", sql: "  " }],
  }).join("\n");
  assert.match(errors, /migration_lock\.toml is missing/);
  assert.match(errors, /Duplicate migration timestamp 20261020101010/);
  assert.match(errors, /"Add-Thing" must be named/);
  assert.match(errors, /20261020101011_c" has an empty migration\.sql/);
});

test("manifest detects schema changes without migrations, missing, unrecorded and edited migrations", () => {
  const schema = "model A {\n id String @id\n}\n";
  const migrations = [{ name: "0_baseline", sql: "CREATE TABLE `a` (`id` VARCHAR(191) NOT NULL);" }];
  const manifest = buildManifest(schema, migrations);
  assert.deepEqual(checkManifest(manifest, schema, migrations), []);
  assert.match(checkManifest(manifest, schema.replace("}", " b Int\n}"), migrations).join(), /schema\.prisma changed/);
  assert.match(checkManifest(manifest, schema, []).join(), /recorded but missing/);
  assert.match(checkManifest(manifest, schema, [...migrations, { name: "20261020101010_add_b", sql: "ALTER TABLE `a` ADD COLUMN `b` INT NULL;" }]).join(), /not recorded/);
  assert.match(checkManifest(manifest, schema, [{ name: "0_baseline", sql: "CREATE TABLE `a` (`id` INT);" }]).join(), /modified after it was recorded/);
  assert.match(checkManifest(null, schema, migrations).join(), /migration-manifest\.json is missing/);
});

test("additive changes apply automatically", () => {
  assert.deepEqual(levels("CREATE TABLE `note` (\n `id` VARCHAR(191) NOT NULL,\n `productId` VARCHAR(191) NOT NULL,\n PRIMARY KEY (`id`)\n);\n\nCREATE UNIQUE INDEX `note_productId_key` ON `note`(`productId`);\n\nALTER TABLE `note` ADD CONSTRAINT `note_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;"), []);
  assert.deepEqual(levels("ALTER TABLE `product` ADD COLUMN `subtitle` VARCHAR(191) NULL;"), []);
  assert.deepEqual(levels("ALTER TABLE `product` ADD COLUMN `rank` INTEGER NOT NULL DEFAULT 0;"), []);
  assert.deepEqual(levels("CREATE INDEX `product_rank_idx` ON `product`(`rank`);"), []);
  assert.deepEqual(levels("-- CreateIndex\nDROP INDEX `product_rank_idx` ON `product`;"), []);
});

test("destructive or data-dependent changes require approval", () => {
  assert.deepEqual(levels("ALTER TABLE `product` DROP COLUMN `subtitle`;"), ["destructive"]);
  assert.deepEqual(levels("DROP TABLE `wantpost`;"), ["destructive"]);
  assert.deepEqual(levels("ALTER TABLE `product` ADD COLUMN `sku` VARCHAR(191) NOT NULL;"), ["risky"]);
  assert.deepEqual(levels("ALTER TABLE `product` MODIFY `name` VARCHAR(100) NOT NULL;"), ["risky"]);
  assert.deepEqual(levels("ALTER TABLE `want` MODIFY `status` ENUM('DRAFT', 'OPEN', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT';"), ["risky"]);
  assert.deepEqual(levels("CREATE UNIQUE INDEX `customer_phone_key` ON `customer`(`phone`);"), ["risky"]);
  assert.deepEqual(levels("ALTER TABLE `order` ADD CONSTRAINT `order_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;"), ["risky"]);
  assert.deepEqual(levels("ALTER TABLE `product` DROP PRIMARY KEY, ADD PRIMARY KEY (`sku`);"), ["destructive", "destructive"]);
  assert.deepEqual(levels("ALTER TABLE `product` RENAME COLUMN `name` TO `title`;"), ["risky"]);
  assert.deepEqual(levels("UPDATE `product` SET `rank` = 0;"), ["risky"]);
  const prismaWarned = "/*\n  Warnings:\n\n  - Added the required column `pin` to the `giftcard` table without a default value. This is not possible if the table is not empty.\n\n*/\n-- AlterTable\nALTER TABLE `giftcard` ADD COLUMN `pin` VARCHAR(10) NOT NULL;\n";
  assert.deepEqual(analyzeMigrationSql(prismaWarned).map((r: { reason: string }) => r.reason.slice(0, 32)), ["Required column without a defaul"]);
  assert.equal(suggestMigrationName(prismaWarned), "add_giftcard_pin");
  const rename = analyzeMigrationSql("ALTER TABLE `product` DROP COLUMN `name`,\n    ADD COLUMN `title` VARCHAR(191) NOT NULL;");
  assert.deepEqual(rename.map((r: { level: string }) => r.level), ["destructive", "risky"]);
  assert.match(rename[0].reason, /rename/i);
});

test("migration names describe the change", () => {
  assert.equal(suggestMigrationName("CREATE TABLE `giftcard` (`id` INT);"), "add_giftcard_table");
  assert.equal(suggestMigrationName("ALTER TABLE `product` ADD COLUMN `subtitle` VARCHAR(191) NULL;"), "add_product_subtitle");
  assert.equal(suggestMigrationName("ALTER TABLE `product` DROP COLUMN `subtitle`;"), "remove_product_subtitle");
  assert.equal(suggestMigrationName("ALTER TABLE `want` MODIFY `status` ENUM('A') NOT NULL;"), "change_want_status");
  assert.equal(suggestMigrationName("CREATE INDEX `x` ON `product`(`rank`);"), "add_product_index");
  assert.equal(suggestMigrationName("-- nothing"), "schema_update");
  assert.equal(isEmptyMigration("-- This is an empty migration."), true);
});

test("development migrations only target a local database", () => {
  assert.deepEqual(assertDevelopmentDatabase("mysql://u:p@localhost:3306/inrange", {}), { host: "localhost", database: "inrange" });
  assert.deepEqual(assertDevelopmentDatabase("mysql://u:p@127.0.0.1/joro_dev", {}), { host: "127.0.0.1", database: "joro_dev" });
  assert.throws(() => assertDevelopmentDatabase(undefined, {}), /DATABASE_URL is not set/);
  assert.throws(() => assertDevelopmentDatabase("mysql://u:p@srv123.hstgr.io/joro", {}), /Only local databases/);
  assert.throws(() => assertDevelopmentDatabase("mysql://u:p@localhost/u749284283_inrange", {}), /production database/);
  assert.throws(() => assertDevelopmentDatabase("mysql://u:p@localhost/inrange", { NODE_ENV: "production" }), /never runs in production/);
  assert.throws(() => assertDevelopmentDatabase("postgres://u:p@localhost/inrange", {}), /mysql:\/\//);
  assert.deepEqual(assertDevelopmentDatabase("mysql://u:p@db.local/joro_dev", { DEV_DATABASE_HOSTS: "db.local" }), { host: "db.local", database: "joro_dev" });
});

test("the repository's committed migrations match schema.prisma", () => {
  const dir = "prisma/migrations";
  const migrations = readdirSync(dir).filter((n) => statSync(`${dir}/${n}`).isDirectory()).sort()
    .map((name) => ({ name, sql: existsSync(`${dir}/${name}/migration.sql`) ? readFileSync(`${dir}/${name}/migration.sql`, "utf8") : null }));
  assert.deepEqual(checkMigrationLayout({ migrations, lockText: readFileSync(`${dir}/migration_lock.toml`, "utf8") }), []);
  const manifest = JSON.parse(readFileSync("prisma/migration-manifest.json", "utf8"));
  assert.deepEqual(checkManifest(manifest, readFileSync("prisma/schema.prisma", "utf8"), migrations), [], "run npm run db:migrate and commit the result");
  assert.deepEqual(analyzeMigrationSql(readFileSync(`${dir}/0_baseline/migration.sql`, "utf8")).map((r: { statement: string }) => r.statement.slice(0, 40)), ["INSERT INTO `servicecommissionrange` (`i"]);
});
