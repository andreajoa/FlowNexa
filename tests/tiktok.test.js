import test from 'node:test';
import assert from 'node:assert/strict';
import {identityDatabase} from './identity-helper.js';
import {sessionFor,sha} from '../src/identity.js';
import {ensureSchema} from '../src/tiktok/schema.js';
import {tiktokApi} from '../src/tiktok/api.js';
import {acceptTikTokWebhook,processTikTokJobs} from '../src/tiktok/runtime.js';
import {zernioWebhook} from '../src/zernio-webhook.js';
import {validateTikTokGraph} from '../src/tiktok/graph.js';
import {normalizeTikTok} from '../src/tiktok/normalize.js';
const remote='a'.repeat(24),profile='b'.repeat(24),origin='https://flownexa.test';
const graph={version:1,start:'hello',nodes:[{id:'hello',type:'message',text:'Olá!',next:'end'},{id:'end',type:'end'}]};
const dm=(id='message/1',text='Oi',at=Date.now())=>({event:'message.received',account:{platform:'tiktok',accountId:remote,profileId:profile},message:{platform:'tiktok',direction:'incoming',sender:{id:'person/1'},platformMessageId:id,conversationId:'thread/1',text,sentAt:new Date(at).toISOString()},conversation:{id:'thread/1'}});
async function fixture(t){
 const db=identityDatabase();t.after(()=>db.close());const calls=[];
 const env={DB:db,ZERNIO_API_KEY:'test',ZERNIO_WEBHOOK_SECRET:'signed-test',TOKEN_ENCRYPTION_KEY:'ab'.repeat(32),TIKTOK_SENDS_ENABLED:'true',ZERNIO_FETCH:async(url,options)=>{calls.push({url:String(url),options});return Response.json({success:true,data:{messageId:'reply/1'}});}};
 db.sqlite.exec("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('u','u@example.test','unused',1),('v','v@example.test','unused',1);INSERT INTO workspaces(id,name,owner_id) VALUES('w','Main','u'),('other','Other','v');INSERT INTO memberships VALUES('w','u','owner'),('other','v','owner');");
 await ensureSchema(env);
 await db.prepare("INSERT INTO tiktok_accounts(id,workspace_id,remote_id,profile_id,native_id,name,created_at) VALUES('a','w',?,?,'business/1','My shop',1)").bind(remote,profile).run();
 const cookie='fn_session='+await sessionFor('u',env);
 const request=(path,body)=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const api=(path,body)=>tiktokApi(request('/api/tiktok'+path,body),env);
 const create=async(trigger='dm_any',g=graph)=>{const r=await api('/flows',{workspace_id:'w',account_id:'a',name:'Test',trigger_type:trigger,keywords:[],graph:g});assert.equal(r.status,200,await r.clone().text());const flow=(await r.json()).flow;await db.prepare('UPDATE tiktok_flows SET enabled=1,published_at=1 WHERE id=?').bind(flow.id).run();return flow;};
 return{db,env,calls,request,api,create};
}
const jobs=f=>f.db.sqlite.prepare('SELECT * FROM tiktok_jobs ORDER BY rowid').all();
test('TikTok CRUD scopes workspaces, checks versions, requires CSRF and enforces send gate',async t=>{
 const f=await fixture(t);assert.equal((await f.api('/accounts?workspace=other')).status,403);
 const flow=await f.create();f.env.TIKTOK_SENDS_ENABLED='false';assert.equal((await f.api('/flows/'+flow.id+'/publish',{workspace_id:'w',version:1})).status,409);
 assert.equal((await f.api('/flows/'+flow.id+'/pause',{workspace_id:'w',version:99})).status,409);
 assert.equal((await f.api('/flows/'+flow.id+'/pause',{workspace_id:'w',version:1})).status,200);
 const r=await tiktokApi(new Request(origin+'/api/tiktok/connect',{method:'POST',body:'{}'}),f.env);assert.equal(r.status,401);
 const req=f.request('/api/tiktok/connect',{workspace_id:'w'});req.headers.set('origin','https://evil.test');assert.equal((await tiktokApi(req,f.env)).status,403);
});
test('TikTok OAuth is profile verified, session-bound and single use',async t=>{
 const f=await fixture(t);let redirect;
 await f.db.prepare("INSERT INTO tiktok_profiles VALUES('w',?)").bind(profile).run();
 f.env.ZERNIO_FETCH=async(url)=>{if(url.pathname.endsWith('/connect/tiktok')){redirect=url.searchParams.get('redirect_url');return Response.json({authUrl:'https://business-api.tiktok.com/portal/auth'});}return Response.json({accounts:[{_id:remote,profileId:profile,platform:'tiktok',platformUserId:'business/1',isActive:true,displayName:'Shop'}]});};
 assert.equal((await f.api('/connect',{workspace_id:'w',reconnect_id:'a'})).status,200);
 const u=new URL(redirect);u.searchParams.set('connected','tiktok');u.searchParams.set('profileId',profile);u.searchParams.set('accountId',remote);
 const req=f.request(u.pathname+u.search);const wrong=new Request(req);wrong.headers.set('cookie','fn_session='+await sessionFor('u',f.env));assert.match((await tiktokApi(wrong,f.env)).headers.get('location'),/invalid_state/);
 assert.match((await tiktokApi(req,f.env)).headers.get('location'),/tiktok_connected=1/);
 assert.match((await tiktokApi(req,f.env)).headers.get('location'),/invalid_state/);
});
test('TikTok signed webhook deduplicates and sends opaque conversation IDs once',async t=>{
 const f=await fixture(t);await f.create();const body=JSON.stringify(dm());
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(f.env.ZERNIO_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('hex');
 const req=()=>new Request(origin+'/webhooks/zernio',{method:'POST',headers:{'x-zernio-signature':sig},body});
 assert.equal((await zernioWebhook(new Request(origin+'/webhooks/zernio',{method:'POST',body}),f.env)).status,403);
 assert.equal((await (await zernioWebhook(req(),f.env)).json()).queued,1);assert.equal((await (await zernioWebhook(req(),f.env)).json()).queued,0);
 await processTikTokJobs(f.env);await processTikTokJobs(f.env);assert.equal(f.calls.length,1);assert.match(f.calls[0].url,/thread%2F1\/messages$/);assert.equal(jobs(f)[0].status,'accepted');assert.equal(jobs(f)[0].encrypted_action,'');assert.ok(f.calls[0].options.headers['Idempotency-Key']);
});
test('TikTok rejects echo, mismatched profile, expired and future messages',async t=>{
 const f=await fixture(t);await f.create();for(const body of [dm('old','Oi',Date.now()-49*3600000),dm('future','Oi',Date.now()+600000),{...dm(),event:'message.sent'}])assert.equal((await (await acceptTikTokWebhook(body,f.env)).json()).queued,0);
 const own=dm();own.message.sender.id='business/1';assert.equal(normalizeTikTok(own,{native_id:'business/1'}),null);
 const bad=dm();bad.account.profileId='wrong';assert.equal((await acceptTikTokWebhook(bad,f.env)).status,400);await processTikTokJobs(f.env);assert.equal(f.calls.length,0);
});
test('TikTok pauses queued effects and honors opt-out immediately',async t=>{
 for(const mode of ['pause','stop','disconnect']){const f=await fixture(t);const flow=await f.create();await acceptTikTokWebhook(dm(),f.env);await processTikTokJobs(f.env,1);assert.equal(jobs(f)[0].status,'pending');
 if(mode==='pause')await f.api('/flows/'+flow.id+'/pause',{workspace_id:'w',version:1});else if(mode==='disconnect')await f.api('/accounts/a/disconnect',{workspace_id:'w'});else await acceptTikTokWebhook(dm('stop','PARAR'),f.env);
 await processTikTokJobs(f.env);assert.equal(f.calls.length,0);assert.equal(jobs(f)[0].status,'cancelled');}
});
test('TikTok ambiguous delivery is never retried; explicit throttling is queued',async t=>{
 for(const mode of ['unknown','rate']){const f=await fixture(t);await f.create();f.env.ZERNIO_FETCH=async()=>{f.calls.push(1);if(mode==='unknown')throw Error('network');return Response.json({}, {status:429});};await acceptTikTokWebhook(dm(),f.env);await processTikTokJobs(f.env);await processTikTokJobs(f.env);assert.equal(f.calls.length,1);assert.equal(jobs(f)[0].status,mode==='unknown'?'unknown':'pending');}
});
test('TikTok graph advances only after acceptance, then consumes the next inbound reply',async t=>{
 const f=await fixture(t),g={version:1,start:'hello',nodes:[{id:'hello',type:'message',text:'Seu nome?',next:'wait'},{id:'wait',type:'wait_reply',on_reply:'thanks',timeout_seconds:3600,on_timeout:'end'},{id:'thanks',type:'message',text:'Obrigado!',next:'end'},{id:'end',type:'end'}]};assert.equal(validateTikTokGraph(g).ok,true);await f.create('dm_any',g);
 await acceptTikTokWebhook(dm('first','Oi',Date.now()-1000),f.env);await processTikTokJobs(f.env,1);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM tiktok_sessions').get().n,0);await processTikTokJobs(f.env);assert.equal(f.db.sqlite.prepare('SELECT node_id FROM tiktok_sessions').get().node_id,'thanks');
 await acceptTikTokWebhook(dm('second','Ana'),f.env);await processTikTokJobs(f.env);assert.equal(JSON.parse(f.calls[1].options.body).message,'Obrigado!');assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM tiktok_sessions').get().n,0);
});
test('TikTok ten-message cap counts accepted and uncertain effects across automations',async t=>{
 const f=await fixture(t);await f.create();for(let i=0;i<11;i++){await acceptTikTokWebhook(dm('m'+i,'Oi',Date.now()-20000+i*100),f.env);await processTikTokJobs(f.env);}assert.equal(f.calls.length,10);assert.equal(jobs(f).at(-1).error,'tiktok_reply_limit');
});
test('TikTok comments reply publicly and never initiate a private conversation',async t=>{
 const f=await fixture(t);await f.create('comment_any');const body={event:'comment.received',account:dm().account,comment:{platform:'tiktok',id:'comment/1',platformPostId:'post/1',isReply:false,author:{id:'person/1'},text:'Oi',createdAt:new Date().toISOString()}};
 await acceptTikTokWebhook(body,f.env);await processTikTokJobs(f.env);assert.equal(f.calls.length,1);assert.match(f.calls[0].url,/inbox\/comments\/post%2F1$/);assert.equal(JSON.parse(f.calls[0].options.body).commentId,'comment/1');
});
test('TikTok rejects unsupported nodes and multiple outgoing messages per inbound event',()=>{
 const g=structuredClone(graph);g.nodes[0].next='two';g.nodes.push({id:'two',type:'message',text:'Again',next:'end'});assert.equal(validateTikTokGraph(g).ok,false);const media=structuredClone(graph);media.nodes[0]={id:'hello',type:'image',url:'https://example.com/image.jpg',next:'end'};assert.equal(validateTikTokGraph(media).ok,false);
});
test('TikTok competing workers cannot deliver the same effect twice',async t=>{
 const f=await fixture(t);await f.create();await acceptTikTokWebhook(dm(),f.env);await processTikTokJobs(f.env,1);await Promise.all([processTikTokJobs(f.env),processTikTokJobs(f.env)]);assert.equal(f.calls.length,1);
});
test('TikTok recovered send after a crashed worker remains uncertain',async t=>{
 const f=await fixture(t);await f.create();await acceptTikTokWebhook(dm(),f.env);await processTikTokJobs(f.env,1);await f.db.prepare("UPDATE tiktok_jobs SET status='sending',attempt_at=?").bind(Date.now()-150000).run();await processTikTokJobs(f.env);assert.equal(f.calls.length,0);assert.equal(jobs(f)[0].status,'unknown');
});
test('TikTok publication refuses competing flows for the same event family',async t=>{
 const f=await fixture(t);await f.create();const r=await f.api('/flows',{workspace_id:'w',account_id:'a',name:'Other',trigger_type:'dm_keyword',keywords:['Oi'],graph});const other=(await r.json()).flow;const result=await f.api('/flows/'+other.id+'/publish',{workspace_id:'w',version:1});assert.equal(result.status,409);assert.equal((await result.json()).error,'tiktok_flow_conflict');
});
test('TikTok timed-out waits must end without unsolicited reminders',()=>{
 const g={version:1,start:'hello',nodes:[{id:'hello',type:'message',text:'Oi',next:'wait'},{id:'wait',type:'wait_reply',on_reply:'end',on_timeout:'reminder',timeout_seconds:60},{id:'reminder',type:'message',text:'Volte',next:'end'},{id:'end',type:'end'}]};assert.equal(validateTikTokGraph(g).error,'tiktok_timeout_must_end');
});
