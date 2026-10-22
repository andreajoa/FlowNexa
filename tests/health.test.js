import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';

test('public health only checks availability; never reads tenant data or mutates flows',async()=>{
 const queries=[];
 const env={DB:{prepare(sql){queries.push(sql);assert.equal(sql,'SELECT 1 AS ok FROM auth_tokens LIMIT 1');return{async first(){return{ok:1}}};}}};
 const response=await app.fetch(new Request('https://flownex.online/api/health'),env);
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'ok',app:'FlowNexa'});assert.equal(queries.length,1);
});
test('public health fails closed for absent or unavailable database',async()=>{
 for(const env of [{},{DB:{prepare(){throw Error('database unavailable')}}}]){
  const response=await app.fetch(new Request('https://flownex.online/api/health'),env);assert.equal(response.status,503);assert.deepEqual(await response.json(),{status:'degraded',database:false});
 }
});

test('public probes, unrelated webhooks and scheduler preserve paused customer presets',async t=>{
 const {identityDatabase}=await import('./identity-helper.js');const {createHmac}=await import('node:crypto');const db=identityDatabase();t.after(()=>db.close());
 db.sqlite.exec(`INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('u','owner@example.test','unused',1);
 INSERT INTO workspaces(id,name,owner_id) VALUES('w','Workspace','u');
 INSERT INTO instagram_accounts(id,workspace_id,username,ig_user_id,status) VALUES('a','w','ambb.outique','123','connected');
 INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES('5078253c-2cd9-4b76-8174-d3886b6d4016','w','a','Paused preset','comment_any','all','{}',0);`);
 const env={DB:db,TOKEN_ENCRYPTION_KEY:'a'.repeat(64),META_WEBHOOK_SECRET:'test-secret',CRON_SECRET:'test-cron-secret',MESSAGING_ENABLED:'false'},body=JSON.stringify({object:'instagram',entry:[]});
 const before=await db.prepare('SELECT * FROM flows').first();
 const requests=[new Request('https://flownex.online/api/health'),new Request('https://flownex.online/webhooks/instagram',{method:'POST',headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',env.META_WEBHOOK_SECRET).update(body).digest('hex')},body}),new Request('https://flownex.online/api/internal/tick',{method:'POST',headers:{authorization:'Bearer '+env.CRON_SECRET}})];
 for(const request of requests){assert.equal((await app.fetch(request,env)).status,200);assert.deepEqual(await db.prepare('SELECT * FROM flows').first(),before);}
});

test('voice readiness remains private, verifies the configured Cloudflare account token and never exposes secrets',async t=>{
 const {identityDatabase}=await import('./identity-helper.js');
 const {sha}=await import('../src/identity.js');
 const db=identityDatabase();t.after(()=>db.close());
 db.sqlite.exec(`INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('u','owner@example.test','unused',1);
 INSERT INTO workspaces(id,name,owner_id) VALUES('w','Workspace','u');
 INSERT INTO memberships(workspace_id,user_id,role) VALUES('w','u','owner');`);
 const session='voice-diagnostic-session';
 await db.prepare('INSERT INTO sessions(id_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha(session),'u',Math.floor(Date.now()/1000)+3600).run();
 let calls=0;
 const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(req,opts)=>{calls++;assert.match(String(req),/accounts\/7ef2450965811249288bc35188f7cbf9\/tokens\/verify/);assert.match(opts.headers.authorization,/Bearer secret/);return Response.json({success:true,result:{status:'active'}});};
 const env={DB:db,CLOUDFLARE_AI_ONLY:'true',CLOUDFLARE_AI_ENABLED:'true',CLOUDFLARE_AI_ACCOUNT_ID:'7ef2450965811249288bc35188f7cbf9',CLOUDFLARE_AI_TOKEN:'secret-account-ai-token-with-padding',VOICE_TRANSCRIPTION_ENABLED:'true',PAUL_ASSISTANT_ENABLED:'true'};
 const url='https://flownex.online/api/voice/status?workspace=w';
 assert.equal((await app.fetch(new Request(url),env)).status,401);
 assert.equal(calls,0);
 assert.equal((await app.fetch(new Request(url.replace('workspace=w','workspace=other'),{headers:{cookie:'fn_session='+session}}),env)).status,403);
 assert.equal(calls,0);
 const response=await app.fetch(new Request(url,{headers:{cookie:'fn_session='+session}}),env);
 assert.equal(response.status,200);
 const payload=await response.json();
 assert.deepEqual(payload,{provider:'cloudflare',free_only:true,cloudflare_configured:true,credential:'valid',voice_ready:true,paul_ready:true});
 assert.equal(calls,1);
 assert.doesNotMatch(JSON.stringify(payload),/secret-account-ai-token/);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
