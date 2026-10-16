import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

test("tracked and intended untracked source files contain no merge conflict markers", () => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const marker = new RegExp(`^(?:${"<".repeat(7)}(?: |$)|${">".repeat(7)}(?: |$)|${"|".repeat(7).replace(/\|/g, "\\|")}(?: |$)|${"=".repeat(7)}$)`, "m");
  const conflicts: string[] = [];
  for (const file of files) {
    if (!/\.(?:tsx?|m?[jc]s|json|css|scss|sql|md|prisma|ya?ml|html)$/.test(file) || !existsSync(file)) continue;
    if (marker.test(readFileSync(file, "utf8").replace(/\r\n/g, "\n"))) conflicts.push(file);
  }
  assert.deepEqual(conflicts, [], "Resolve source conflicts before committing");
});

test("vendor notification migration preserves historical jobs and replaces only the notification uniqueness rule", () => {
  const sql = readFileSync("prisma/migrations/20261016010000_vendor_order_notifications/migration.sql", "utf8").replace(/--[^\n]*/g, "");
  const statements = sql.split(";").map(statement => statement.trim()).filter(Boolean);
  assert.equal(statements.length, 3);
  assert.match(statements[0], /^ALTER TABLE `OrderConfirmationEmail` ADD COLUMN `recipientKey` VARCHAR\(191\) NOT NULL DEFAULT 'customer'$/);
  assert.match(statements[1], /^CREATE UNIQUE INDEX `OrderConfirmationEmail_orderId_recipientKey_key` ON `OrderConfirmationEmail`\(`orderId`, `recipientKey`\)$/);
  assert.match(statements[2], /^DROP INDEX `OrderConfirmationEmail_orderId_key` ON `OrderConfirmationEmail`$/);
  const schema = readFileSync("prisma/schema.prisma", "utf8").match(/model OrderConfirmationEmail \{([\s\S]*?)\n\}/)![1];
  assert.match(schema, /recipientKey\s+String\s+@default\("customer"\)\s+@db.VarChar\(191\)/);
  assert.match(schema, /@@unique\(\[orderId, recipientKey\]\)/);
  assert.doesNotMatch(schema, /orderId\s+String\s+@unique/);
  const original = readFileSync("prisma/migrations/20261015020000_order_confirmation_outbox/migration.sql", "utf8");
  assert.match(original, /CREATE TABLE `OrderConfirmationEmail`/);
  assert.match(original, /UNIQUE INDEX `OrderConfirmationEmail_orderId_key`\(`orderId`\)/);
});
