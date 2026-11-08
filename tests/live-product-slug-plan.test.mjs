import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveSlugPlan, applyLiveSlugPlan, verifyLiveSlugRows } from '../scripts/lib/live-product-slug-plan.mjs';
const context = { database: 'approved-live-target', commit: 'a'.repeat(40), digest: 'payload', expectedProducts: 13, backup: { file: '/private/backup.sql', hash: 'verified-hash' } };
const fixtures = () => Array.from({ length: 13 }, (_, i) => ({ id: 'product-' + i, name: i < 2 ? 'Same title' : 'Title ' + i, slug: null, price: '1250.50', stock: 30 + i, categoryRecordId: 'category', listingImageUrls: ['/image-' + i + '.png'], variants: ['Black'], createdAt: new Date(i * 1000), updatedAt: new Date(0) }));
function database(initial, corrupt = false) {
  let rows = structuredClone(initial), transactions = 0;
  return {
    get rows() { return rows; }, get transactions() { return transactions; },
    async $transaction(fn, options) {
      assert.equal(options.isolationLevel, 'Serializable'); transactions++;
      const working = structuredClone(rows);
      const result = await fn({ product: {
        findMany: async () => structuredClone(working),
        updateMany: async ({ where, data }) => {
          assert.equal(where.slug, null);
          assert.deepEqual(Object.keys(data).sort(), ['slug', 'updatedAt']);
          const row = working.find(row => row.id === where.id && row.slug === null);
          if (!row) return { count: 0 };
          Object.assign(row, data);
          if (corrupt) row.stock--;
          return { count: 1 };
        },
      } });
      rows = working; return result;
    },
  };
}
test('live plan binds backup, identity and commit; transaction preserves all product fields', async () => {
  const before = fixtures(), plan = createLiveSlugPlan(before, context), db = database(before);
  assert.equal(plan.assignments.length, 13);
  assert.equal(new Set(plan.assignments.map(row => row.slug)).size, 13);
  assert.deepEqual(await applyLiveSlugPlan(db, plan, context), { products: 13, uniqueSlugs: 13, preservedProductData: true });
  assert.deepEqual(db.rows.map(row => ({ ...row, slug: null })), before);
  assert.equal(verifyLiveSlugRows(db.rows, plan, context).products, 13);
});
test('wrong live target, commit, payload, count or backup cannot open a write transaction', async () => {
  const plan = createLiveSlugPlan(fixtures(), context);
  for (const changed of [{ database: 'local' }, { commit: 'other' }, { digest: 'other' }, { expectedProducts: 14 }, { backup: { ...context.backup, hash: 'other' } }]) {
    const db = database(fixtures());
    await assert.rejects(applyLiveSlugPlan(db, plan, { ...context, ...changed }));
    assert.equal(db.transactions, 0);
  }
});
test('stale data and tampered assignments are rejected without committed updates', async () => {
  const before = fixtures(), plan = createLiveSlugPlan(before, context);
  const changed = fixtures(); changed[0].price = '999';
  const db = database(changed); await assert.rejects(applyLiveSlugPlan(db, plan, context)); assert.deepEqual(db.rows, changed);
  const tampered = structuredClone(plan); tampered.assignments[0].slug = 'wrong';
  const other = database(before); await assert.rejects(applyLiveSlugPlan(other, tampered, context)); assert.deepEqual(other.rows, before);
});
test('an unexpected stock mutation rolls back the entire backfill', async () => {
  const before = fixtures(), db = database(before, true);
  await assert.rejects(applyLiveSlugPlan(db, createLiveSlugPlan(before, context), context), /Product price, stock/);
  assert.deepEqual(db.rows, before);
});
