import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import config from '../next.config.mjs';
const require = createRequire(import.meta.url);
const { matchHas, prepareDestination } = require('next/dist/shared/lib/router/utils/prepare-destination');
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match');
const { formatUrl } = require('next/dist/shared/lib/router/utils/format-url');

async function redirect(host, path = '/', extraHeaders = {}) {
  const parsed = new URL(path, 'https://fixture.invalid');
  const query = Object.create(null);
  for (const [key, value] of parsed.searchParams) {
    if (!Object.hasOwn(query, key)) query[key] = value;
    else query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value];
  }
  for (const rule of await config.redirects()) {
    const params = getPathMatch(rule.source)(parsed.pathname);
    const matched = matchHas({ headers: { host, ...extraHeaders } }, query, rule.has, rule.missing);
    if (params && matched) return { rule, url: new URL(formatUrl(prepareDestination({
      destination: rule.destination, params: { ...params, ...matched }, query, appendParamsToQuery: false,
    }).parsedDestination)) };
  }
  return null;
}

test('exact www host permanently redirects root, product paths and repeated/encoded queries to HTTPS apex', async () => {
  for (const path of ['/', '/products/example-product', '/products/example-product?utm_source=a&utm_source=b&q=a%26b&next=https%3A%2F%2Fevil.example']) {
    const result = await redirect('www.joro.pk', path);
    assert.ok(result); assert.equal(result.rule.permanent, true);
    assert.equal(result.url.origin, 'https://joro.pk');
    const original = new URL(path, 'https://www.joro.pk');
    assert.equal(result.url.pathname, original.pathname);
    assert.deepEqual([...result.url.searchParams], [...original.searchParams]);
  }
});

test('apex, localhost, internal, preview and lookalike hosts never match', async () => {
  for (const host of ['joro.pk', 'joro.pk:443', 'localhost:3000', '127.0.0.1:3000', '0.0.0.0:3000', 'preview.example', 'wwwXjoroXpk', 'www.joro.pk.evil.example', 'evilwww.joro.pk', undefined]) {
    assert.equal(await redirect(host), null, String(host));
  }
});

test('spoofed forwarded-host/proto cannot redirect apex or select a different destination', async () => {
  for (const forwarded of ['www.joro.pk', 'attacker.example', 'www.joro.pk, attacker.example']) {
    assert.equal(await redirect('joro.pk', '/products/p1', { 'x-forwarded-host': forwarded, 'x-forwarded-proto': 'http' }), null);
    assert.equal(await redirect('0.0.0.0:3000', '/', { 'x-forwarded-host': forwarded }), null);
    const result = await redirect('www.joro.pk', '/', { 'x-forwarded-host': forwarded, 'x-forwarded-proto': 'http' });
    assert.equal(result.url.href, 'https://joro.pk/');
  }
});

test('WWW host case/port normalization is handled by Next and the destination cannot redirect itself', async () => {
  for (const host of ['WWW.JORO.PK', 'www.joro.pk:443']) {
    const first = await redirect(host, '/categories/mobile-accessories?sort=newest');
    assert.equal(first.url.hostname, 'joro.pk');
    assert.equal(await redirect(first.url.host, first.url.pathname + first.url.search), null);
  }
});

test('login, OAuth, checkout and API paths retain their exact paths and query data on www; apex stays unchanged', async () => {
  for (const path of ['/login?role=customer&callbackUrl=%2Fcheckout', '/api/auth/callback/google?code=fixture&state=a%2Bb', '/checkout?step=delivery', '/api/orders?fixture=1', '/api/example-webhook?signature=a%2Fb']) {
    const result = await redirect('www.joro.pk', path);
    const original = new URL(path, 'https://www.joro.pk');
    assert.equal(result.url.origin, 'https://joro.pk');
    assert.equal(result.url.pathname, original.pathname);
    assert.deepEqual([...result.url.searchParams], [...original.searchParams]);
    assert.equal(await redirect('joro.pk', path), null);
  }
});

test('existing secure public-upload rewrite is preserved', async () => {
  assert.deepEqual((await config.rewrites()).beforeFiles, [{ source: '/uploads/:path*', destination: '/api/uploads/:path*' }]);
});
