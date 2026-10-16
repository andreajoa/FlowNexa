// The application remains on Vercel. This Worker only supplies its minute trigger.
export const TICK_URL = 'https://flownex.online/api/internal/tick';
export async function tick(env, fetcher = fetch) {
  if (typeof env.CRON_SECRET !== 'string' || env.CRON_SECRET.length < 24) throw new Error('scheduler_configuration_missing');
  const response = await fetcher(TICK_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.CRON_SECRET, 'content-type': 'application/json' },
    body: '{}',
    redirect: 'error',
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) throw new Error('scheduler_tick_http_' + response.status);
  const data = await response.json();
  // Only aggregate counters are logged. Never log headers, credentials or jobs.
  const counters = {};
  for (const key of ['processed', 'sent', 'failed', 'skipped', 'pending', 'uncertain', 'requeued']) {
    if (typeof data[key] === 'number') counters[key] = data[key];
  }
  console.log(JSON.stringify({ service: 'flownexa-runner', event: 'tick_completed', ...counters }));
  return counters;
}
export default {
  async scheduled(controller, env) { await tick(env); },
  async fetch(request) {
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return Response.json({ service: 'flownexa-runner', status: 'ok', cron: '* * * * *' }, { headers: { 'cache-control': 'no-store' } });
    }
    return new Response('Not found', { status: 404 });
  }
};
