// Populated local-only MySQL rehearsal. Never reads .env.live.local or production.
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { assertDevelopmentDatabase, prismaCliEnvironment } from './lib/migration-tools.mjs';

dotenv.config({ quiet: true });
assertDevelopmentDatabase(process.env.DATABASE_URL, process.env);
const base = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(base.hostname) || (base.port || '3306') !== '3306') throw new Error('Rehearsal requires the local development server on port 3306; production tunnel port is forbidden.');
const token = Date.now() + '_' + randomUUID().slice(0, 8);
const name = 'joro_disposable_slugs_' + token;
const restoreName = 'joro_disposable_restore_' + token;
const artifact = path.resolve('node_modules/.cache/catalog-slug-rehearsal', token);
fs.mkdirSync(artifact, { recursive: true });
const schemaDir = path.join(artifact, 'prisma');
fs.mkdirSync(path.join(schemaDir, 'migrations'), { recursive: true });
const slugMigration = '20261108000000_product_readable_slug';
for (const file of fs.readdirSync('prisma/migrations')) {
  if (file !== slugMigration) fs.cpSync(path.join('prisma/migrations', file), path.join(schemaDir, 'migrations', file), { recursive: true });
}
const currentSchema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const oldSchema = currentSchema.replace(/(model Product \{\r?\n)\s*slug String\? @unique @db\.VarChar\(191\)\r?\n/, '$1');
assert.notEqual(oldSchema, currentSchema, 'Remove only Product.slug for the pre-migration schema');
const schemaFile = path.join(schemaDir, 'schema.prisma');
fs.writeFileSync(schemaFile, oldSchema);
const target = new URL(base); target.pathname = '/' + name; target.searchParams.set('connection_limit', '1');
const restoredTarget = new URL(target); restoredTarget.pathname = '/' + restoreName;
const env = prismaCliEnvironment({ ...process.env, DATABASE_URL: target.toString(), JORO_DEPLOY_MIGRATIONS: 'false' });
const db = new PrismaClient({ datasourceUrl: target.toString() });
const restored = new PrismaClient({ datasourceUrl: restoredTarget.toString() });
let child;
const report = { localOnly: true, fixtureData: true, database: name, restoredDatabase: restoreName, checks: [], http: [] };
function redact(text) {
  let result = String(text || '');
  for (const secret of [target.toString(), restoredTarget.toString(), decodeURIComponent(base.password), base.password]) if (secret) result = result.split(secret).join('[REDACTED]');
  return result.replace(/mysql:\/\/[^\s"']+/g, '[REDACTED URL]');
}
function run(args, label, extraEnv = {}) {
  const result = spawnSync(process.execPath, args, { env: { ...env, ...extraEnv }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  fs.writeFileSync(path.join(artifact, label + '.log'), redact(result.stdout) + redact(result.stderr));
  return result;
}
function cli(args, label) {
  const result = run(['node_modules/prisma/build/index.js', ...args], label);
  assert.equal(result.status, 0, label + ': ' + redact(result.stderr).slice(-1200));
}
function pass(check) { report.checks.push(check); console.log('PASS ' + check); }
const identifier = value => { assert.match(value, /^[a-zA-Z0-9_]+$/); return '`' + value + '`'; };
function pack(value, type) {
  if (value === null) return null;
  if (value instanceof Date) return { date: value.toISOString() };
  if (value instanceof Uint8Array) return { bytes: Buffer.from(value).toString('base64') };
  if (type === 'json') return { json: typeof value === 'string' ? JSON.parse(value) : value };
  if (typeof value === 'bigint') return { bigint: value.toString() };
  if (typeof value === 'object' && typeof value.toFixed === 'function') return { decimal: value.toString() };
  return value;
}
function unpack(value) {
  if (value === null || typeof value !== 'object') return value;
  if ('date' in value) return new Date(value.date);
  if ('bytes' in value) return Buffer.from(value.bytes, 'base64');
  if ('json' in value) return JSON.stringify(value.json);
  if ('bigint' in value) return BigInt(value.bigint);
  if ('decimal' in value) return value.decimal;
  throw new Error('Unexpected backup cell');
}
async function snapshot(client) {
  const tables = await client.$queryRawUnsafe('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE=\'BASE TABLE\' ORDER BY TABLE_NAME');
  const out = [];
  for (const table of tables) {
    const columns = await client.$queryRawUnsafe('SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION', table.name);
    const ddl = Object.values((await client.$queryRawUnsafe('SHOW CREATE TABLE ' + identifier(table.name)))[0])[1];
    const rows = (await client.$queryRawUnsafe('SELECT * FROM ' + identifier(table.name))).map(row => Object.fromEntries(columns.map(column => [column.name, pack(row[column.name], column.type)])));
    rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    out.push({ name: table.name, ddl, columns, rows });
  }
  return out;
}
const dataOnly = dump => dump.map(table => ({ name: table.name, rows: table.rows }));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function unchanged(before, after) {
  const normalized = after.map(table => ({ ...table, rows: table.rows
    .filter(row => table.name !== '_prisma_migrations' || row.migration_name !== slugMigration)
    .map(row => { const result = { ...row }; if (table.name === 'product') delete result.slug; return result; }) }));
  for (const table of normalized) table.rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  assert.equal(hash(dataOnly(normalized)), hash(dataOnly(before)), 'Every original table/row/cell must remain unchanged apart from product.slug');
}
async function seed() {
  const date = new Date('2026-11-01T12:00:00Z');
  await db.category.create({ data: { id: 'stage-category', legacyId: 1, name: 'Staging Audio', slug: 'staging-audio', image: '/icon.png', showOnHome: true }, select: { id: true } });
  for (const id of ['one', 'two']) await db.vendor.create({ data: { id: 'stage-vendor-' + id, ownerName: 'Fixture Owner ' + id, shopName: 'Fixture Shop ' + id, email: id + '@example.invalid', passwordHash: 'not-a-live-account', address: 'Fixture address', status: 'approved', storeSlug: 'fixture-shop-' + id }, select: { id: true } });
  const titles = ['Wireless Headphones', 'Wireless Headphones', 'Womens Fashion', "Women's Fashion", 'Café Audio', '!!!', 'Wireless Headphones 2', 'stage-product-01', 'Inactive Audio', 'Vendor Audio', 'Archived Listing', 'Special & Unicode Audio'];
  for (let i = 0; i < titles.length; i++) {
    const id = 'stage-product-' + String(i + 1).padStart(2, '0');
    await db.product.create({ data: { id, name: titles[i], description: 'Original fixture description ' + i, price: '1250.50', originalPrice: '1500.00', category: 'Staging Audio', categoryRecordId: 'stage-category', stock: i === 2 ? 0 : 20 + i, variants: ['Black', 'Green'], listingImageUrls: i % 2 ? ['/icon.png', '/joro-logo.svg'] : undefined, isActive: ![8, 10].includes(i), legacyNewArrivalId: i === 0 ? 1 : undefined, createdAt: new Date(date.getTime() + i * 1000), updatedAt: date }, select: { id: true } });
    await db.productImage.create({ data: { id: 'stage-image-' + i, productId: id, mimeType: 'image/png', data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'), sortOrder: 0 }, select: { id: true } });
    if (i % 2) await db.vendorProduct.create({ data: { id: 'stage-publication-' + i, vendorId: 'stage-vendor-' + (i % 3 ? 'one' : 'two'), publishedProductId: id, productName: titles[i], description: 'Original vendor description', category: 'Staging Audio', price: '1250.50', stock: 20 + i, images: ['/icon.png'], status: 'active' }, select: { id: true } });
  }
  await db.customer.create({ data: { id: 'stage-customer', name: 'Fixture Customer', email: 'customer@example.invalid', passwordHash: 'not-a-live-account' }, select: { id: true } });
  await db.order.create({ data: { id: 'stage-order', orderNumber: 'STAGE-ORDER-1', customerId: 'stage-customer', customerName: 'Fixture Customer', customerPhone: '03000000000', customerEmail: 'customer@example.invalid', customerAddress: 'Fixture address', city: 'Lahore', totalAmount: '2501.00', paymentMethod: 'cod', orderItems: { create: { id: 'stage-order-item', productId: 'stage-product-02', name: titles[1], price: '1250.50', quantity: 2, image: '/icon.png', variant: 'Black' } } }, select: { id: true } });
  await db.savedProduct.create({ data: { customerId: 'stage-customer', productId: 'stage-product-02' } });
}
async function startHttp() {
  // Isolated release cache prevents earlier fixture sitemaps contaminating this database test.
  const release = path.join(artifact, 'release'); fs.mkdirSync(release);
  fs.cpSync('.next', path.join(release, '.next'), { recursive: true, filter: source => path.basename(source) !== 'cache' });
  for (const file of ['next.config.mjs', 'package.json']) fs.copyFileSync(file, path.join(release, file));
  fs.symlinkSync(path.resolve('node_modules'), path.join(release, 'node_modules'), 'junction');
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', release, '-H', '127.0.0.1', '-p', String(port)], { cwd: release, env: { ...env, NODE_ENV: 'production', MAINTENANCE_MODE: 'false', JORO_NEXT_DIST_DIR: '', NEXTAUTH_SECRET: 'isolated-staging-not-production', NEXTAUTH_URL: 'http://127.0.0.1:' + port }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
  const deadline = Date.now() + 45000;
  while (!log.includes('Ready in')) { if (child.exitCode !== null || Date.now() > deadline) throw new Error('Staging HTTP startup failed: ' + redact(log).slice(-1000)); await new Promise(resolve => setTimeout(resolve, 100)); }
  return 'http://127.0.0.1:' + port;
}
async function get(origin, url, status, location, agent = 'Mozilla/5.0') {
  const response = await fetch(origin + url, { redirect: 'manual', headers: { 'user-agent': agent } });
  const body = await response.text();
  assert.equal(response.status, status, url + ': ' + body.slice(0, 150));
  if (location) assert.equal(response.headers.get('location'), location);
  report.http.push({ path: url, status, location: response.headers.get('location'), agent });
  return body;
}

try {
  cli(['migrate', 'deploy', '--schema', schemaFile], '01-before-schema');
  await seed();
  const before = await snapshot(db);
  assert.equal(await db.product.count(), 12);
  assert.equal((await db.$queryRawUnsafe("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND COLUMN_NAME='slug'"))[0].n, 0n);
  const backupFile = path.join(artifact, 'before-migration-backup.json');
  fs.writeFileSync(backupFile, JSON.stringify(before, null, 2));
  report.backupSha256 = createHash('sha256').update(fs.readFileSync(backupFile)).digest('hex');
  report.productCount = 12; report.tableCount = before.length;
  pass('nine-migration pre-slug database populated with 12 products, duplicate titles, two vendors, images, stock, category, saved product and order relationships');
  fs.cpSync(path.join('prisma/migrations', slugMigration), path.join(schemaDir, 'migrations', slugMigration), { recursive: true });
  fs.writeFileSync(schemaFile, currentSchema);
  cli(['migrate', 'deploy', '--schema', schemaFile], '02-slug-schema');
  cli(['migrate', 'status', '--schema', schemaFile], '03-migration-status');
  cli(['migrate', 'diff', '--from-url', target.toString(), '--to-schema-datamodel', schemaFile, '--exit-code'], '04-schema-diff');
  unchanged(before, await snapshot(db));
  assert.equal(await db.product.count({ where: { slug: null } }), 12);
  const column = (await db.$queryRawUnsafe("SELECT IS_NULLABLE AS nullable, CHARACTER_MAXIMUM_LENGTH AS length FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND COLUMN_NAME='slug'"))[0];
  assert.equal(column.nullable, 'YES'); assert.equal(Number(column.length), 191);
  const index = await db.$queryRawUnsafe("SELECT NON_UNIQUE AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND COLUMN_NAME='slug'");
  assert.ok(index.some(row => Number(row.nonUnique) === 0));
  pass('only nullable VARCHAR(191) slug and unique index added; every original data cell and relationship preserved');
  const origin = await startHttp();
  await get(origin, '/products/stage-product-01', 200);
  pass('existing public ID URL remains HTTP 200 with NULL slug before backfill');
  const planFile = path.join(artifact, 'slug-plan.json');
  const backfill = ['--require', './scripts/test-userinfo-fallback.cjs', '--import', 'tsx', 'scripts/catalog-slugs.ts'];
  assert.equal(run([...backfill, '--write-plan', planFile], '05-plan').status, 0);
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  assert.equal(plan.products, 12); assert.equal(plan.assignments.length, 12);
  const tamperedFile = path.join(artifact, 'tampered-plan.json');
  const tampered = structuredClone(plan); tampered.assignments[0].slug = 'incorrect-target'; fs.writeFileSync(tamperedFile, JSON.stringify(tampered));
  const apply = file => [...backfill, '--apply-plan', file, '--expect-database', plan.database, '--confirm-catalog-writes-paused'];
  assert.notEqual(run(apply(tamperedFile), '06-refuse-tampered-plan').status, 0);
  assert.equal(await db.product.count({ where: { slug: null } }), 12);
  pass('tampered plan refused without any assignments');
  assert.equal(run(apply(planFile), '07-apply-backfill').status, 0);
  unchanged(before, await snapshot(db));
  const products = await db.product.findMany({ select: { id: true, slug: true, isActive: true, name: true }, orderBy: { id: 'asc' } });
  assert.equal(products.filter(p => p.slug).length, 12); assert.equal(new Set(products.map(p => p.slug)).size, 12);
  report.mapping = products;
  pass('actual CLI backfill assigns 12 unique stable slugs including inactive products, preserving all original cells and timestamps');
  const afterBackfill = await snapshot(db);
  await assert.rejects(db.$transaction(async tx => {
    await tx.product.update({ where: { id: products[2].id }, data: { slug: 'temporary-rollback-probe' } });
    await tx.product.update({ where: { id: products[1].id }, data: { slug: products[0].slug } });
  }), error => error.code === 'P2002');
  assert.equal(hash(dataOnly(await snapshot(db))), hash(dataOnly(afterBackfill)));
  pass('database unique index rejects collisions and transaction rollback restores earlier writes');
  const secondPlan = path.join(artifact, 'idempotent-plan.json');
  assert.equal(run([...backfill, '--write-plan', secondPlan], '08-idempotent-plan').status, 0);
  assert.equal(JSON.parse(fs.readFileSync(secondPlan, 'utf8')).assignments.length, 0);
  assert.equal(run(apply(secondPlan), '09-idempotent-apply').status, 0);
  assert.equal(hash(dataOnly(await snapshot(db))), hash(dataOnly(afterBackfill)));
  pass('replanning/reapplying is idempotent with zero slug changes');
  for (const agent of ['Mozilla/5.0', 'Googlebot']) {
    for (const product of products.filter(p => p.isActive)) {
      const destination = '/products/' + product.slug;
      await get(origin, '/products/' + product.id + '?variant=Black&token=private', 308, destination + '?variant=Black', agent);
      const html = await get(origin, destination, 200, undefined, agent);
      assert.ok(html.includes('<link rel="canonical" href="https://joro.pk' + destination + '"'));
    }
    await get(origin, '/new-arrivals/1', 308, '/products/' + products[0].slug, agent);
    await get(origin, '/categories/stage-category', 308, '/categories/staging-audio', agent);
    await get(origin, '/categories/staging-audio', 200, undefined, agent);
    await get(origin, '/products/stage-product-09', 404, undefined, agent);
    await get(origin, '/products/missing-product', 404, undefined, agent);
  }
  const sitemap = await get(origin, '/sitemaps/products-0.xml', 200);
  for (const product of products.filter(p => p.isActive)) assert.ok(sitemap.includes('/products/' + product.slug));
  assert.ok(!sitemap.includes('/products/stage-product-01<'));
  await get(origin, '/robots.txt', 200); await get(origin, '/sitemap.xml', 200);
  assert.equal(hash(dataOnly(await snapshot(db))), hash(dataOnly(afterBackfill)));
  pass('real populated-database HTTP checks: all public old IDs 308 directly to correct slug 200, missing/inactive 404, category/legacy-arrival redirects, canonicals/sitemaps/robots; HTTP reads change no database data');
  // Restore the complete pre-migration logical backup into a separate new database.
  await db.$executeRawUnsafe('CREATE DATABASE ' + identifier(restoreName));
  await restored.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
  const savedBackup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  for (const table of savedBackup) await restored.$executeRawUnsafe(table.ddl);
  for (const table of savedBackup) for (const row of table.rows) {
    const columns = Object.keys(row);
    await restored.$executeRawUnsafe('INSERT INTO ' + identifier(table.name) + ' (' + columns.map(identifier).join(',') + ') VALUES (' + columns.map(() => '?').join(',') + ')', ...columns.map(column => unpack(row[column])));
  }
  await restored.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
  assert.equal(hash(dataOnly(await snapshot(restored))), hash(dataOnly(before)));
  assert.equal((await restored.$queryRawUnsafe("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product' AND COLUMN_NAME='slug'"))[0].n, 0n);
  report.restoredDataSha256 = hash(dataOnly(before));
  pass('complete pre-migration logical backup restores into a separate new database with exact all-table data/history equality and no slug column');
  pass('post-publication rollback compatibility: persisted slugs and ID redirects retained; no destructive reset/drop or ID-only rollback performed');
  report.success = true;
} catch (error) {
  report.success = false; report.error = redact(error.stack || error);
  console.error(report.error); process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
  await db.$disconnect(); await restored.$disconnect();
  fs.writeFileSync(path.join(artifact, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Rehearsal artifacts: ' + path.relative(process.cwd(), artifact));
  // Leave only explicitly named disposable databases for inspection. Never reset/drop a configured database.
}
