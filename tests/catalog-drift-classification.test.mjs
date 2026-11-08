import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCatalogDrift } from '../scripts/lib/classify-catalog-drift.mjs';
const sql = 'ALTER TABLE `product` DROP FOREIGN KEY `Product_categoryRecordId_fkey`;\nALTER TABLE `product` ADD CONSTRAINT `product_categoryRecordId_fkey` FOREIGN KEY (`categoryRecordId`) REFERENCES `category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;\nCREATE UNIQUE INDEX `product_name_key` ON `product`(`name`);\nDROP INDEX `Product_name_key` ON `product`;\nDROP TABLE `wantpost`;';
const fk = [{ TABLE_NAME: 'product', CONSTRAINT_NAME: 'Product_categoryRecordId_fkey', COLUMN_NAME: 'categoryRecordId', ORDINAL_POSITION: 1, REFERENCED_TABLE_NAME: 'category', REFERENCED_COLUMN_NAME: 'id', DELETE_RULE: 'SET NULL', UPDATE_RULE: 'CASCADE' }];
const ix = [{ TABLE_NAME: 'product', INDEX_NAME: 'Product_name_key', COLUMN_NAME: 'name', SEQ_IN_INDEX: 1, NON_UNIQUE: 0, SUB_PART: null, COLLATION: 'A' }];
test('documented legacy and case-only differences require matching actual semantics', () => {
  assert.equal(classifyCatalogDrift(sql, fk, ix).documentedDifferencesOnly, true);
  assert.equal(classifyCatalogDrift(sql, [{ ...fk[0], DELETE_RULE: 'CASCADE' }], ix).documentedDifferencesOnly, false);
  assert.equal(classifyCatalogDrift(sql, fk, [{ ...ix[0], NON_UNIQUE: 1 }]).documentedDifferencesOnly, false);
});
test('column changes, unknown tables and unpaired removals are never classified as cosmetic', () => {
  for (const extra of ['ALTER TABLE `product` DROP COLUMN `stock`;', 'DROP TABLE `order`;', 'DROP INDEX `unknown` ON `product`;']) assert.equal(classifyCatalogDrift(sql + extra, fk, ix).documentedDifferencesOnly, false);
});
