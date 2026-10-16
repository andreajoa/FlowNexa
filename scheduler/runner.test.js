import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { tick, TICK_URL } from './runner.js';
const env = { CRON_SECRET: 'test-secret-only-abcdefghijklmnopqrstuvwxyz' };
test('scheduled runner posts only to the fixed Vercel endpoint with authorization', async () => {
  let call;
  const result = await tick(env, async (url, options) => { call = { url, options }; return Response.json({ processed: 3, sent: 2, jobs: [{ private: 'not logged' }] }); });
  assert.equal(call.url, TICK_URL);
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers.authorization, 'Bearer ' + env.CRON_SECRET);
  assert.equal(call.options.redirect, 'error');
  assert.deepEqual(result, { processed: 3, sent: 2 });
});
test('runner fails visibly for rejected requests and never follows redirects', async () => {
  await assert.rejects(tick(env, async () => new Response(null, { status: 403 })), /scheduler_tick_http_403/);
  await assert.rejects(tick(env, async () => new Response(null, { status: 302 })), /scheduler_tick_http_302/);
});
test('missing secret cannot trigger a request and public HTTP cannot run jobs', async () => {
  let called = false;
  await assert.rejects(tick({}, async () => { called = true; }), /configuration_missing/);
  assert.equal(called, false);
  assert.equal((await worker.fetch(new Request('https://runner.test/run', { method: 'POST' }))).status, 404);
  assert.equal((await worker.fetch(new Request('https://runner.test/health'))).status, 200);
});
