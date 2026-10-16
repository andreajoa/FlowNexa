import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {identityDatabase} from './identity-helper.js';
import runtime from '../src/index.js';import {runtimeApi} from '../src/runtime-api.js';import {sha} from '../src/identity.js';
import {encryptToken,instagramOauth} from '../src/instagram-oauth.js';import {enqueueWebhook,processPending} from '../src/automation-engine.js';import {normalizeWebhook} from '../src/flow-runtime.js';
async function setup(action='message'){
 const db=identityDatabase();db.sqlite.exec(readFileSync(new URL('../migrations/0005_runtime.sql',import.meta.url),'utf8'));
 db.sqlite.exec("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('u','owner@example.test','unused',1),('v','other@example.test','unused',1); INSERT INTO workspaces(id,name,owner_id) VALUES('w','Main','u'),('other','Other','v'); INSERT INTO memberships VALUES('w','u','owner'),('other','v','owner');");
 await db.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await sha('session'),'u',Math.floor(Date.now()/1000)+3600).run();
 const env={DB:db,TOKEN_ENCRYPTION_KEY:'a'.repeat(64),MESSAGING_ENABLED:'true',META_APP_ID:'123',META_APP_SECRET:'secret',META_REDIRECT_URI:'https://flownex.online/api/instagram/callback'};
 await db.prepare("INSERT INTO instagram_accounts(id,workspace_id,username,ig_user_id,encrypted_token,token_expires_at,status) VALUES ('a','w','brand','100',?,?,'connected')").bind(await encryptToken('not-real-token',env.TOKEN_ENCRYPTION_KEY),Math.floor(Date.now()/1000)+864000).run();
 await db.prepare("INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES ('f','w','a','Test',?,'all',?,1)").bind(action==='message'?'dm_keyword':'comment_any',JSON.stringify({keywords:['link'],actions:[{type:action,text:'Here is your requested link'}]})).run();
 let posts=0;env.META_FETCH=async(url,init)=>{if(init.method==='POST'){posts++;return Response.json({message_id:'mid-'+posts,id:'reply-'+posts});}return Response.json({id:'300',timestamp:new Date().toISOString()});};
 return{db,env,posts:()=>posts};
}
const dm=(mid='event1',time=Date.now())=>({object:'instagram',entry:[{id:'100',messaging:[{sender:{id:'200'},recipient:{id:'100'},timestamp:time,message:{mid,text:'link'}}]}]});
const comment=(from='200')=>({object:'instagram',entry:[{id:'100',time:Date.now(),changes:[{field:'comments',value:{id:'300',from:{id:from},media:{id:'400'},text:'link'}}]}]});
const req=(path,method='GET',body)=>new Request('https://flownex.online'+path,{method,headers:{cookie:'fn_session=session',origin:'https://flownex.online','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
test('signed queue rejects forged payload and deduplicates repeated event delivery and overlapping consumers',async()=>{
 const{db,env,posts}=await setup();try{
  const bad=await runtime.fetch(new Request('https://flownex.online/webhooks/instagram',{method:'POST',body:JSON.stringify(dm())}),env);assert.equal(bad.status,403);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM automation_events').get().n,0);
  await Promise.all([enqueueWebhook(dm(),env),enqueueWebhook(dm(),env)]);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM automation_events').get().n,1);
  await Promise.all([processPending(env),processPending(env)]);assert.equal(posts(),1);const job=db.sqlite.prepare('SELECT * FROM automation_jobs').get();assert.equal(job.status,'accepted');assert.equal(job.provider_id,'mid-1');assert.ok(!job.encrypted_action.includes('Here is'));
 }finally{db.close();}
});
test('timeout/empty successful response is unknown and never retried automatically',async()=>{
 for(const result of ['timeout','empty']){const{db,env}=await setup();let n=0;env.META_FETCH=async()=>{n++;if(result==='timeout')throw new TypeError('connection lost');return Response.json({});};try{await enqueueWebhook(dm(),env);await processPending(env);await processPending(env);assert.equal(n,1);assert.equal(db.sqlite.prepare('SELECT status FROM automation_jobs').get().status,'unknown');}finally{db.close();}}
});
test('provider 429 recovers through a later authenticated tick without another webhook',async()=>{
 const{db,env}=await setup();let n=0;env.CRON_SECRET='cron';env.META_FETCH=async()=>++n===1?Response.json({error:{code:4}},{status:429}):Response.json({message_id:'ok'});
 try{await enqueueWebhook(dm(),env);await processPending(env);assert.equal(db.sqlite.prepare('SELECT status FROM automation_events').get().status,'pending');db.sqlite.exec('UPDATE automation_events SET due_at=0');const tick=await runtime.fetch(new Request('https://flownex.online/api/internal/tick',{method:'POST',headers:{authorization:'Bearer cron'}}),env);assert.equal(tick.status,200);assert.equal(db.sqlite.prepare('SELECT status FROM automation_jobs').get().status,'accepted');assert.equal(n,2);}finally{db.close();}
});
test('pause/version change cancels a queued flow, expired DM never posts, own comment never enqueues',async()=>{
 const{db,env,posts}=await setup();try{await enqueueWebhook(dm(),env);db.sqlite.exec('UPDATE flows SET enabled=0,version=2');await processPending(env);assert.equal(posts(),0);db.sqlite.exec('UPDATE flows SET enabled=1');await enqueueWebhook(dm('old',Date.now()-2*86400000),env);await processPending(env);assert.equal(posts(),0);assert.equal(db.sqlite.prepare('SELECT error FROM automation_jobs').get().error,'message_window_expired');assert.deepEqual(normalizeWebhook(comment('100')),[]);}finally{db.close();}
});
test('private reply deduplicates overlapping matching flows and checks actual provider comment timestamp',async()=>{
 const{db,env,posts}=await setup('private_reply');try{db.sqlite.exec("INSERT INTO flows SELECT 'f2',workspace_id,account_id,'Second',trigger_type,scope,configuration,enabled,version,created_at FROM flows WHERE id='f'");await enqueueWebhook(comment(),env);await processPending(env);assert.equal(posts(),1);await enqueueWebhook(comment(),env);await processPending(env);assert.equal(posts(),1);}finally{db.close();}
 const s=await setup('private_reply');s.env.META_FETCH=async()=>Response.json({timestamp:'2020-01-01T00:00:00Z'});try{await enqueueWebhook(comment(),s.env);await processPending(s.env);assert.equal(s.db.sqlite.prepare('SELECT error FROM automation_jobs').get().error,'private_reply_window_expired');}finally{s.db.close();}
});
test('tenant isolation, viewer write refusal, draft edits pause active flows and publish requires configured messaging',async()=>{
 const{db,env}=await setup();try{assert.equal((await runtimeApi(req('/api/flows?workspace=other'),env)).status,403);assert.equal((await runtimeApi(req('/api/accounts/a/disconnect','POST',{}),env)).status,200);assert.equal((await runtimeApi(req('/api/flows/f/publish','POST',{}),env)).status,409);
  db.sqlite.exec("UPDATE instagram_accounts SET status='connected'; UPDATE memberships SET role='viewer' WHERE user_id='u'");assert.equal((await runtimeApi(req('/api/flows/f','PATCH',{name:'Edited'}),env)).status,404);db.sqlite.exec("UPDATE memberships SET role='owner' WHERE user_id='u'");const edit=await runtimeApi(req('/api/flows/f','PATCH',{name:'Edited'}),env);assert.equal(edit.status,200);assert.equal((await edit.json()).flow.enabled,0);env.MESSAGING_ENABLED='false';assert.equal((await runtimeApi(req('/api/flows/f/publish','POST',{}),env)).status,503);
 }finally{db.close();}
});
test('OAuth state binds initiating browser and rejects revoked membership before provider calls',async()=>{
 const{db,env}=await setup();try{const start=await instagramOauth(req('/api/instagram/connect?workspace=w'),env);const state=new URL((await start.json()).authorization_url).searchParams.get('state');assert.ok(state);const callback='/api/instagram/callback?state='+state+'&code=notreal';assert.equal((await instagramOauth(new Request('https://flownex.online'+callback),env)).status,401);db.sqlite.exec("DELETE FROM memberships WHERE user_id='u'");assert.equal((await instagramOauth(req(callback),env)).status,403);}finally{db.close();}
});
test('interrupted sending reservation becomes unknown instead of sending again',async()=>{
 const{db,env,posts}=await setup();try{await enqueueWebhook(dm(),env);await processPending(env);db.sqlite.exec("UPDATE automation_jobs SET status='sending',provider_id=NULL; UPDATE automation_events SET status='processing',lease_until=0");await processPending(env);assert.equal(posts(),1);assert.equal(db.sqlite.prepare('SELECT status FROM automation_jobs').get().status,'unknown');}finally{db.close();}
});
test('accepted provider result followed by DB write failure is unknown, never reported rejected or resent',async()=>{
 const{db,env,posts}=await setup();const original=db.prepare;let failed=false;db.prepare=(sql)=>{const statement=original(sql);if(sql.includes("SET status='accepted'")&&!failed){failed=true;return{bind(){return{async run(){throw Error('simulated database outage')}}}};}return statement;};
 try{await enqueueWebhook(dm(),env);await processPending(env);assert.equal(posts(),1);assert.equal(db.sqlite.prepare('SELECT status FROM automation_jobs').get().status,'unknown');await processPending(env);assert.equal(posts(),1);}finally{db.close();}
});
test('oversized webhook batch refuses the entire batch without silently discarding events',async()=>{
 const{db,env}=await setup();try{const payload=dm();payload.entry[0].messaging=Array.from({length:101},(_,i)=>dm('event'+i).entry[0].messaging[0]);await assert.rejects(enqueueWebhook(payload,env),/webhook_batch_too_large/);assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM automation_events').get().n,0);}finally{db.close();}
});
test('OAuth operational connection requires confirmed subscription, rejects replay and never stores raw token',async()=>{
 const{db,env}=await setup();let subscribed=false;env.META_FETCH=async(url,init={})=>{const u=String(url);if(u.includes('/oauth/access_token'))return Response.json({access_token:'short',user_id:'999'});if(u.includes('/access_token?'))return Response.json({access_token:'long-token-secret',expires_in:5184000});if(u.includes('/me?')){assert.equal(new URL(u).searchParams.get('fields'),'user_id,username');return Response.json({user_id:'500',username:'authorized_test'});}if(u.includes('/subscribed_apps')&&init.method==='POST'){assert.equal(new URL(u).pathname,'/v24.0/me/subscribed_apps');subscribed=true;return Response.json({success:true});}if(u.includes('/subscribed_apps'))return Response.json({data:[{id:env.META_APP_ID,subscribed_fields:['comments','messages']}]});throw Error('unexpected mock request');};
 try{const start=await instagramOauth(req('/api/instagram/connect?workspace=w'),env),state=new URL((await start.json()).authorization_url).searchParams.get('state'),callback='/api/instagram/callback?state='+state+'&code=code';const done=await instagramOauth(req(callback),env);assert.equal(done.status,302);assert.equal(new URL(done.headers.get('location')).pathname,'/app');assert.ok(subscribed);const stored=db.sqlite.prepare("SELECT encrypted_token,status FROM instagram_accounts WHERE ig_user_id='500'").get();assert.equal(stored.status,'connected');assert.ok(!stored.encrypted_token.includes('long-token-secret'));assert.equal((await instagramOauth(req(callback),env)).status,403);}finally{db.close();}
});
