// English dashboard at /app?lang=en: same app, copy swapped from APP_EN (no runtime machine translation).
import {appPage} from './app-ui.js';
import {appClient} from './app-client.js';
import {APP_EN} from './app-en-strings.js';

const swap = text => {
 const key = text.trim(), en = APP_EN[key];
 return en === undefined ? text : text.replace(key, en.trim());
};

export function appPageEn() {
 const parts = appPage('en').replace(/<script([^>]*)src="\/app\.js"/, '<script$1src="/app.js?lang=en"')
  .split(/(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>)/);
 return parts.map((part, i) => i % 2 ? part : part
  .replace(/>([^<>]+)</g, (m, t) => '>' + swap(t) + '<')
  .replace(/((?:alt|aria-label|placeholder|title)=")([^"]+)"/g, (m, a, t) => a + swap(t) + '"')).join('');
}

export function appClientEn() {
 return appClient()
  .replace(/(["'`])((?:\\.|(?!\1)[^\\\n]){0,600}?)\1/g, (m, q, t) => {
   // Escape-aware: a \\' inside one string must not shift the pairing of every string after it.
   const en = APP_EN[t];
   return en === undefined ? m : q + en.replaceAll(q, '\\' + q) + q;
  })
  .replaceAll("'/app'", "'/app?lang=en'");
}

// Language for /app: explicit ?lang wins; otherwise the browser's first language (English-speaking markets get English).
export function appLocale(request) {
 const url = new URL(request.url), lang = url.searchParams.get('lang');
 if (lang) return lang === 'en' ? 'en' : 'pt-BR';
 const first = (request.headers.get('accept-language') || '').split(',')[0].trim().toLowerCase();
 return first.startsWith('en') ? 'en' : 'pt-BR';
}
