import test from 'node:test';
import assert from 'node:assert/strict';
import {appPageEn, appClientEn, appLocale} from '../src/app-en.js';
import {identityEmail} from '../src/transactional-email.js';

const ACCENTED = /[ãçõéêáíóúâàÃÇÉÁÍÓÚ]/;

test('English dashboard has no Portuguese copy left and its script still parses', () => {
 const page = appPageEn(), client = appClientEn();
 assert.match(page, /<html lang="en">/);
 assert.match(page, /src="\/app\.js\?lang=en"/);
 assert.doesNotMatch(page.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ''), ACCENTED);
 assert.doesNotThrow(() => new Function(client));
 for (const m of client.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n]){0,600}?)\1/g)) assert.doesNotMatch(m[2], ACCENTED, m[2]);
 assert.match(client, /Create your FlowNexa account/);
 assert.match(client, /'\/app\?lang=en'/);
});

test('language: explicit ?lang wins, otherwise the browser language decides', () => {
 const r = (url, al) => new Request(url, {headers: al ? {'accept-language': al} : {}});
 assert.equal(appLocale(r('https://flownex.online/app?lang=en')), 'en');
 assert.equal(appLocale(r('https://flownex.online/app?lang=pt', 'en-US')), 'pt-BR');
 assert.equal(appLocale(r('https://flownex.online/app', 'en-GB,en;q=0.9')), 'en');
 assert.equal(appLocale(r('https://flownex.online/app', 'pt-BR,pt;q=0.9')), 'pt-BR');
 assert.equal(appLocale(r('https://flownex.online/app')), 'pt-BR');
});

test('verification email keeps the language: English link stays in English, Portuguese in Portuguese', () => {
 const en = identityEmail({purpose: 'verify_email', token: 't', locale: 'en'}, {});
 assert.match(en.text, /\/app\?lang=en#verify=t/);
 const pt = identityEmail({purpose: 'verify_email', token: 't', locale: 'pt-BR'}, {});
 assert.match(pt.subject, /Confirme/);
 assert.match(pt.text, /\/app#verify=t/);
});
