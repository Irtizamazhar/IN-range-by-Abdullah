import test from 'node:test';
import assert from 'node:assert/strict';
import { QUERIES, assertAuditQuery, diffArgs } from '../scripts/check-services-production-readonly.mjs';

test('production audit accepts only its fixed metadata SELECT statements', () => {
  for (const sql of Object.values(QUERIES)) { assert.match(sql, /^SELECT /); assert.equal(assertAuditQuery(sql), sql); }
  for (const sql of ['SELECT 1', 'UPDATE serviceoffering SET active=1', 'DELETE FROM `order`', 'CREATE TABLE x(id int)', 'SELECT 1 INTO OUTFILE "x"', QUERIES.version + '; DELETE FROM `order`']) assert.throws(() => assertAuditQuery(sql), /allowlist/);
});
test('schema comparison cannot apply SQL or create a shadow database', () => {
  const args = diffArgs('previous.prisma', 'proposal.prisma');
  assert.deepEqual(args, ['migrate','diff','--from-schema-datasource','previous.prisma','--to-schema-datamodel','proposal.prisma','--exit-code']);
  for (const forbidden of ['deploy','dev','reset','execute','--script','--from-migrations','--to-migrations','--shadow-database-url']) assert.equal(args.includes(forbidden), false);
});
