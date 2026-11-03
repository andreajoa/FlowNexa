import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
// Cloudflare Workers' fetch only accepts redirect "follow" or "manual"; "error" throws before the request is sent
// (Instagram connection and token refresh broke this way after the move from Vercel).
test('no fetch uses redirect "error" (unsupported on Workers)',()=>{
 for(const f of readdirSync('src').filter(x=>x.endsWith('.js'))){const s=readFileSync('src/'+f,'utf8');assert.ok(!/redirect\s*:\s*['"]error['"]/.test(s),f);}
});
