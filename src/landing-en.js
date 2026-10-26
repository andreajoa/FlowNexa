// English landing at /en: same approved layout, copy swapped from LANDING_EN (no runtime machine translation).
import {landingPage} from "./landing.js";
import {landingClient} from "./landing-script.js";
import {LANDING_EN} from "./landing-en-strings.js";

const ORIGIN = "https://flownex.online";
const HREFLANG = `<link rel="alternate" hreflang="pt-BR" href="${ORIGIN}/"><link rel="alternate" hreflang="en" href="${ORIGIN}/en"><link rel="alternate" hreflang="x-default" href="${ORIGIN}/">`;

const swap = (text) => {
  const key = text.trim();
  const en = LANDING_EN[key];
  return en === undefined ? text : text.replace(key, en);
};

export function landingPagePt() {
  return landingPage().replace('<link rel="canonical"', HREFLANG + '<link rel="canonical"');
}

export function landingPageEn() {
  let html = landingPage()
    .replace('<html lang="pt-BR">', '<html lang="en">')
    .replace('<link rel="canonical" href="https://flownex.online/">', HREFLANG + '<link rel="canonical" href="https://flownex.online/en">')
    .replace('<meta property="og:url" content="https://flownex.online/">', '<meta property="og:url" content="https://flownex.online/en">')
    .replace('<span class="highlight">Automação</span>de Direct no<br>Instagram', '<span class="highlight">Instagram</span>DM<br>automation')
    .replace(/src="\/landing\.js"/g, 'src="/en/landing.js"')
    .replace(/href="\/"/g, 'href="/en"')
    .replace(/href="\/app\?([^"#]*)/g, 'href="/app?lang=en&$1')
    .replace(/href="\/app(#[^"]*)?"/g, (m, hash) => `href="/app?lang=en${hash || ""}"`);
  const parts = html.split(/(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>)/);
  return parts.map((part, i) => i % 2 ? part : part
    .replace(/>([^<>]+)</g, (m, t) => ">" + swap(t) + "<")
    .replace(/((?:alt|aria-label|content|placeholder|title)=")([^"]+)"/g, (m, a, t) => a + swap(t) + '"')
  ).join("");
}

export function landingClientEn() {
  return landingClient().replace(/(["'`])((?:(?!\1)[^\\\n]){3,260}?)\1/g, (m, q, t) => {
    const en = LANDING_EN[t];
    return en === undefined ? m : q + en.replaceAll(q, "\\" + q) + q;
  });
}
