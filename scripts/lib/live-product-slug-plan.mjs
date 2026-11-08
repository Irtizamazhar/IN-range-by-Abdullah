import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { planProductSlugs, catalogFingerprint } = createRequire(import.meta.url)('../../lib/product-slug-plan.ts');
const ordered = { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] };
const check = (condition, message) => { if (!condition) throw new Error(message); };
const selected = rows => rows.map(({ id, name, slug, updatedAt }) => ({ id, name, slug, updatedAt }));
export function productDataFingerprint(rows) {
  return createHash('sha256').update(JSON.stringify(rows.map(row => {
    const copy = { ...row }; delete copy.slug; return copy;
  }))).digest('hex');
}
export function createLiveSlugPlan(rows, context) {
  check(rows.length === context.expectedProducts, 'Product count changed; review the catalog before making a new plan.');
  return {
    version: 1, mode: 'joro-live-product-slugs', database: context.database,
    releaseCommit: context.commit, manifestDigest: context.digest,
    backup: { file: context.backup.file, hash: context.backup.hash },
    products: rows.length, fingerprint: catalogFingerprint(selected(rows)),
    productDataFingerprint: productDataFingerprint(rows), assignments: planProductSlugs(rows),
  };
}
export function validateLivePlanContext(plan, context) {
  check(plan.version === 1 && plan.mode === 'joro-live-product-slugs', 'Invalid live plan; generate it with the live runner.');
  check(plan.database === context.database, 'Plan database identity mismatch.');
  check(plan.releaseCommit === context.commit && plan.manifestDigest === context.digest, 'Plan release revision or migration payload changed.');
  check(plan.backup?.hash === context.backup.hash && plan.backup?.file === context.backup.file, 'Plan backup changed.');
  check(plan.products === context.expectedProducts, 'Plan product count does not match the reviewed count.');
}
export function verifyLiveSlugRows(rows, plan, context) {
  validateLivePlanContext(plan, context);
  check(rows.length === plan.products, 'Product count changed.');
  const assigned = new Map(plan.assignments.map(row => [row.id, row.slug]));
  check(rows.every(row => row.slug && (!assigned.has(row.id) || row.slug === assigned.get(row.id))), 'Slug coverage or exact mapping verification failed.');
  check(planProductSlugs(rows).length === 0, 'Slug uniqueness or ID namespace verification failed.');
  const original = selected(rows).map(row => ({ ...row, slug: assigned.has(row.id) ? null : row.slug }));
  check(catalogFingerprint(original) === plan.fingerprint, 'IDs, names, timestamps or existing mappings changed.');
  check(productDataFingerprint(rows) === plan.productDataFingerprint, 'Product price, stock, images, category/relationship IDs or other product fields changed.');
  return { products: rows.length, uniqueSlugs: new Set(rows.map(row => row.slug)).size, preservedProductData: true };
}
export async function applyLiveSlugPlan(db, plan, context) {
  validateLivePlanContext(plan, context);
  return db.$transaction(async tx => {
    const before = await tx.product.findMany(ordered);
    const current = createLiveSlugPlan(before, context);
    check(current.fingerprint === plan.fingerprint && current.productDataFingerprint === plan.productDataFingerprint && JSON.stringify(current.assignments) === JSON.stringify(plan.assignments), 'Stale or modified plan; no backfill may proceed.');
    const original = new Map(before.map(row => [row.id, row]));
    for (const assignment of plan.assignments) {
      const result = await tx.product.updateMany({ where: { id: assignment.id, slug: null }, data: { slug: assignment.slug, updatedAt: original.get(assignment.id).updatedAt } });
      check(result.count === 1, 'Concurrent product change; rolling back.');
    }
    return verifyLiveSlugRows(await tx.product.findMany(ordered), plan, context);
  }, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 300_000 });
}
export const liveProductOrder = ordered;
