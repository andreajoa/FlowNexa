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
