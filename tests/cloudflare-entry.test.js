import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/cloudflare-entry.js';

const STAGE = 'https://flownexa-migration-staging.example.workers.dev';
const PROD = 'https://flownex.online';

test('Cloudflare gateway serves public landing assets for both locales', async () => {
  for (const path of ['/', '/en', '/landing.js', '/en/landing.js', '/sitemap.xml']) {
    const res = await worker.fetch(new Request(STAGE + path), {}, {});
    assert.equal(res.status, 200, path);
    assert.ok((await res.text()).length > 100, path);
  }
});

test('Cloudflare gateway serves application and protects unauthenticated APIs', async () => {
  const panel = await worker.fetch(new Request(STAGE + '/app'), {}, {});
  assert.equal(panel.status, 200);
  assert.match(panel.headers.get('content-type'), /text\/html/);
  const restricted = await worker.fetch(new Request(STAGE + '/api/flows'), {DB: {prepare: () => ({first: async () => null})}}, {});
  assert.equal(restricted.status, 401);
});

test('Cloudflare gateway uses native D1 binding for health', async () => {
  const db = {prepare: () => ({first: async () => ({ok: 1})})};
  const res = await worker.fetch(new Request(STAGE + '/api/health'), {DB: db}, {});
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('Cloudflare gateway rejects foreign origins before handling mutations', async () => {
  const req = new Request(PROD + '/api/flows', {
    method: 'POST',
    headers: {origin: 'https://example.net', 'content-type': 'application/json'},
    body: '{}',
  });
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 403);
});

test('Cloudflare preview hostname stays unindexable', async () => {
  const res = await worker.fetch(new Request(STAGE + '/robots.txt'), {}, {});
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Disallow: \/$/m);
});
