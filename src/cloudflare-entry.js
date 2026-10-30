import app from './index.js';
import {landingPagePt, landingPageEn, landingClientEn} from './landing-en.js';
import {landingClient} from './landing-script.js';

const MAX_BODY_BYTES = 1024 * 1024;
const PUBLIC_ORIGIN = 'https://flownex.online';

function response(body, type, extra = {}) {
  return new Response(body, {
    headers: {
      'content-type': type,
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}

function landing(request, path) {
  const isEnglish = path.startsWith('/en');
  const isScript = path.endsWith('/landing.js');
  const body = isScript
    ? (isEnglish ? landingClientEn() : landingClient())
    : (isEnglish ? landingPageEn() : landingPagePt());
  const type = isScript ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8';
  const extra = {
    'cache-control': isScript ? 'public, max-age=300' : 'public, max-age=60',
  };
  if (!isScript) {
    extra['content-security-policy'] = "default-src 'self'; img-src 'self' https://images.unsplash.com; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'";
  }
  return response(request.method === 'HEAD' ? null : body, type, extra);
}

async function fetchHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === 'GET' || request.method === 'HEAD') {
    if (path === '/robots.txt' && url.hostname.endsWith('.workers.dev')) {
      return response(request.method === 'HEAD' ? null : 'User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8', {'cache-control':'no-store'});
    }
    if (path === '/robots.txt') {
      const body = 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /webhooks/\nDisallow: /mcp\nDisallow: /app.js\nSitemap: ' + PUBLIC_ORIGIN + '/sitemap.xml\n';
      return response(request.method === 'HEAD' ? null : body, 'text/plain; charset=utf-8', {'cache-control': 'public, max-age=3600'});
    }
    if (path === '/sitemap.xml') {
      const paths = ['/', '/en', '/privacy', '/terms', '/data-deletion'];
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + paths.map(p => '  <url><loc>' + PUBLIC_ORIGIN + p + '</loc></url>').join('\n')
        + '\n</urlset>\n';
      return response(request.method === 'HEAD' ? null : xml, 'application/xml; charset=utf-8', {'cache-control': 'public, max-age=3600'});
    }
    if (['/', '/landing.js', '/en', '/en/', '/en/landing.js'].includes(path)) return landing(request, path);
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return new Response('Forbidden origin', {status: 403});
    const length = Number(request.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) return new Response('Payload too large', {status: 413});
  }

  return app.fetch(request, env, ctx);
}

export default {
  fetch: fetchHandler,
  async scheduled(_controller, env, ctx) {
    if (!env.CRON_SECRET || env.MESSAGING_ENABLED !== 'true') return;
    const request = new Request(PUBLIC_ORIGIN + '/api/internal/tick', {
      method: 'POST',
      headers: {authorization: 'Bearer ' + env.CRON_SECRET},
    });
    ctx.waitUntil(app.fetch(request, env, ctx));
  },
};
