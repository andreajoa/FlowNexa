import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {identityDatabase} from './identity-helper.js';
import {sessionFor} from '../src/identity.js';
import runtime from '../src/index.js';
import {ensureZernioSchema} from '../src/zernio-connection.js';
import {processPending} from '../src/automation-engine.js';
import {sendAction,messagingReady} from '../src/meta-client.js';
import {accountUsable,zernioRequest} from '../src/zernio-client.js';
const origin='https://flownex.online',profile='a'.repeat(24),remote='b'.repeat(24),other='c'.repeat(24);
async function setup(t){
 const db=identityDatabase();t.after(()=>db.close());
 for(const file of ['0005_runtime.sql','0008_conversations.sql'])db.sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 db.sqlite.exec("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('u','u@example.test','unused',1); INSERT INTO workspaces(id,name,owner_id) VALUES('w','Workspace','u'); INSERT INTO memberships VALUES('w','u','owner');");
 const env={DB:db,TOKEN_ENCRYPTION_KEY:'a'.repeat(64),ZERNIO_API_KEY:'secret-provider-key',ZERNIO_WEBHOOK_SECRET:'webhook-secret',MESSAGING_ENABLED:'true',INSTAGRAM_CONNECTION_PROVIDER:'zernio'};
 await ensureZernioSchema(env);
 const cookie='fn_session='+await sessionFor('u',env),calls=[];
 let redirect;
 env.ZERNIO_FETCH=async(input,options={})=>{
  const url=new URL(input),body=options.body?JSON.parse(options.body):null;calls.push({url,options,body});assert.equal(url.origin,'https://zernio.com');assert.equal(options.headers.authorization,'Bearer secret-provider-key');
  if(url.pathname==='/api/v1/profiles'&&options.method==='GET')return Response.json({profiles:[]});
  if(url.pathname==='/api/v1/profiles')return Response.json({profile:{_id:profile,externalId:body.externalId}},{status:201});
  if(url.pathname==='/api/v1/connect/instagram'){redirect=new URL(url.searchParams.get('redirect_url'));return Response.json({authUrl:'https://www.instagram.com/oauth/authorize?state=provider-state'});}
  if(url.pathname==='/api/v1/accounts')return Response.json({accounts:[{_id:remote,profileId:{_id:profile},platform:'instagram',isActive:true,platformUserId:'123456789',username:'gilberto.rebuild'}]});
  if(url.pathname.endsWith('/private-reply'))return Response.json({status:'success',messageId:'private-message'});
  if(url.pathname.endsWith('/messages'))return Response.json({success:true,data:{messageId:'dm-message'}});
  if(url.pathname==='/api/v1/inbox/comments/777')return Response.json({success:true,data:{commentId:'reply'}});
  if(url.pathname===`/api/v1/accounts/${remote}/posts`)return Response.json({posts:[{id:'777',message:'Legenda',mediaType:'IMAGE',permalink:'https://www.instagram.com/p/post/',picture:'https://cdn.example.test/image.jpg'}]});
  if(options.method==='DELETE')return Response.json({success:true});
  throw Error('Unexpected provider path '+url.pathname);
 };
 const request=(path,method='GET',body)=>new Request(origin+path,{method,headers:{cookie,origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const connect=()=>runtime.fetch(request('/api/instagram/connect?workspace=w'),env);
 async function callback(changes={}){const params=new URLSearchParams({connected:'instagram',profileId:profile,accountId:remote,...changes});for(const[k,v]of params)redirect.searchParams.set(k,v);return runtime.fetch(request(redirect.pathname+redirect.search),env);}
 async function connected(){assert.equal((await connect()).status,200);assert.equal((await callback()).status,302);return db.prepare('SELECT * FROM instagram_accounts').first();}
 async function webhook(body,{signature=true,raw}={}){const text=raw||JSON.stringify(body),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ZERNIO_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))).toString('hex');return runtime.fetch(new Request(origin+'/webhooks/zernio',{method:'POST',headers:{'x-zernio-signature':signature?sig:'0'.repeat(64)},body:text}),env);}
 return{db,env,calls,request,connect,callback,connected,webhook,get redirect(){return redirect;}};
}
const comment=()=>({id:'event-comment',event:'comment.received',account:{accountId:remote,platform:'instagram'},comment:{id:'999',platformPostId:'777',platform:'instagram',text:'quero',author:{id:'222'},createdAt:new Date().toISOString(),isReply:false,parentCommentId:null}});
const dm=()=>({id:'event-message',event:'message.received',account:{accountId:remote,platform:'instagram'},message:{id:'internal-message',platformMessageId:'platform-message',conversationId:'opaque/thread:123',platform:'instagram',direction:'incoming',sender:{id:'222'},sentAt:new Date().toISOString(),text:'quero'},conversation:{id:'opaque/thread:123'}});

test('Zernio OAuth verifies session, profile and remote account before creating a provider connection',async t=>{
 const{db,env,calls,request,connect,callback}=await setup(t);
 assert.equal((await runtime.fetch(new Request(origin+'/api/instagram/connect?workspace=w'),env)).status,401);
 assert.equal((await runtime.fetch(request('/api/instagram/connect?workspace=foreign'),env)).status,403);assert.equal(calls.length,0);
 assert.equal((await connect()).status,200);assert.equal((await callback()).status,302);
 const account=await db.prepare('SELECT * FROM instagram_accounts').first();assert.equal(account.ig_user_id,'zernio:'+remote);assert.equal(account.encrypted_token,null);assert.equal(account.token_expires_at,null);assert.ok(accountUsable(account));assert.ok(messagingReady(env,account));
 const call=calls.find(c=>c.url.pathname.endsWith('/connect/instagram'));assert.equal(call.url.searchParams.get('scopes'),'comments,messaging');assert.equal(call.url.searchParams.get('forceReauth'),'true');
 assert.equal((await callback()).status,403);assert.doesNotMatch(JSON.stringify(account),/secret-provider-key/);
});
test('Zernio callback rejects profile substitution, stolen browser state and expired state',async t=>{
 const{db,env,request,connect,callback}=await setup(t);
 await connect();assert.equal((await callback({profileId:other})).status,400);assert.equal((await db.prepare('SELECT count(*) n FROM instagram_accounts').first()).n,0);
 await connect();db.sqlite.exec('UPDATE zernio_oauth_states SET expires_at=0');assert.equal((await callback()).status,403);
 await connect();db.sqlite.exec("DELETE FROM memberships WHERE user_id='u'");assert.equal((await callback()).status,403);
});
test('remote OAuth account ownership is fetched server-side; query username and IDs grant no access',async t=>{
 const{env,db,connect,callback}=await setup(t);const fetcher=env.ZERNIO_FETCH;
 env.ZERNIO_FETCH=(u,o)=>new URL(u).pathname==='/api/v1/accounts'?Promise.resolve(Response.json({accounts:[{_id:remote,profileId:other,platform:'instagram',isActive:true,platformUserId:'123',username:'victim'}]})):fetcher(u,o);
 await connect();assert.equal((await callback({username:'forged'})).status,409);assert.equal((await db.prepare('SELECT count(*) n FROM instagram_accounts').first()).n,0);
});
test('connecting again preserves the local account and never reactivates paused flows',async t=>{
 const{db,connected,connect,callback}=await setup(t);const first=await connected();await db.prepare("INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES('paused','w',?,'Paused','comment_any','all',?,0)").bind(first.id,JSON.stringify({actions:[{type:'private_reply',text:'Original'}]})).run();await connect();assert.equal((await callback()).status,302);assert.equal((await db.prepare('SELECT id FROM instagram_accounts').first()).id,first.id);assert.equal((await db.prepare("SELECT enabled FROM flows WHERE id='paused'").first()).enabled,0);
});
test('signed comment reaches existing durable queue and private reply exactly once through Zernio',async t=>{
 const{env,db,calls,connected,webhook}=await setup(t);const account=await connected();
 await db.prepare("INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES('f','w',?,'Flow','comment_any','all',?,1)").bind(account.id,JSON.stringify({actions:[{type:'private_reply',text:'Seu link'}]})).run();
 const body=comment();assert.equal((await webhook(body,{signature:false})).status,403);assert.equal((await webhook({...body,test:true})).status,200);
 const accepted=await webhook(body);assert.equal(accepted.status,200);assert.equal((await accepted.json()).queued,1);await processPending(env);
 assert.equal((await db.prepare('SELECT status,provider_id FROM automation_jobs').first()).provider_id,'private-message');
 assert.equal((await(await webhook(body)).json()).queued,0);await processPending(env);assert.equal(calls.filter(c=>c.url.pathname.endsWith('/private-reply')).length,1);
});
test('DM identity and opaque conversation ID survive ingestion, rich delivery and window checks',async t=>{
 const{env,db,calls,connected,webhook}=await setup(t);const account=await connected();
 await db.prepare("INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES('f','w',?,'Flow','dm_keyword','all',?,1)").bind(account.id,JSON.stringify({keywords:['quero'],actions:[{type:'message',text:'Olá'}]})).run();
 assert.equal((await(await webhook(dm())).json()).queued,1);await processPending(env);assert.equal((await db.prepare('SELECT provider_id FROM automation_jobs').first()).provider_id,'dm-message');
 const call=calls.find(c=>c.url.pathname.endsWith('/messages'));assert.equal(call.body.accountId,remote);assert.equal(call.url.pathname,'/api/v1/inbox/conversations/opaque%2Fthread%3A123/messages');
 await assert.rejects(sendAction(env,account,{kind:'dm',sender_id:'222',at:Date.now()-2*86400000,conversation_id:'thread'},{type:'message',text:'old'}),/message_window_expired/);
});
test('outbound, standby, own comments, reply comments, unknown accounts and vendor samples do not trigger automation',async t=>{
 const{db,connected,webhook}=await setup(t);await connected();
 for(const body of [{...dm(),test:true},{...dm(),metadata:{standby:true}},{...dm(),message:{...dm().message,direction:'outgoing'}},{...comment(),comment:{...comment().comment,isReply:true}},{...comment(),comment:{...comment().comment,author:{id:'123456789',isOwnAccount:true}}},{...dm(),account:{accountId:other,platform:'instagram'}}])assert.equal((await(await webhook(body)).json()).queued,0);
 assert.equal((await db.prepare('SELECT count(*) n FROM automation_events').first()).n,0);
});
test('uncertain Zernio send is retained as unknown and is not automatically resent',async t=>{
 const{env,db,connected,webhook}=await setup(t);const account=await connected();let sends=0;const fetcher=env.ZERNIO_FETCH;
 env.ZERNIO_FETCH=(u,o)=>{if(o.method==='POST'&&new URL(u).pathname.endsWith('/messages')){sends++;return Promise.resolve(Response.json({error:'platform secret-provider-key'},{status:502}));}return fetcher(u,o);};
 await db.prepare("INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES('f','w',?,'Flow','dm_keyword','all',?,1)").bind(account.id,JSON.stringify({keywords:['quero'],actions:[{type:'message',text:'Olá'}]})).run();
 await webhook(dm());await processPending(env);await processPending(env);assert.equal(sends,1);assert.equal((await db.prepare('SELECT status FROM automation_jobs').first()).status,'unknown');
});
test('media uses Zernio and local disconnect disables automations before remote deletion',async t=>{
 const{env,db,request,connected,calls}=await setup(t);const account=await connected();
 const media=await runtime.fetch(request('/api/accounts/'+account.id+'/media'),env);assert.equal(media.status,200);assert.equal((await media.json()).media[0].id,'777');
 assert.equal((await runtime.fetch(request('/api/accounts/'+account.id+'/disconnect','POST'),env)).status,200);assert.equal((await db.prepare('SELECT status FROM instagram_accounts').first()).status,'disconnected');assert.ok(calls.some(c=>c.options.method==='DELETE'));
});
test('provider transport never follows redirects and never exposes upstream secret messages',async()=>{
 let options;await assert.rejects(zernioRequest({ZERNIO_API_KEY:'key',ZERNIO_FETCH:async(u,o)=>{options=o;return Response.json({error:'private-token'},{status:401});}},'accounts'),error=>error.message==='zernio_request_rejected'&&!error.message.includes('private-token'));assert.equal(options.redirect,'error');
});

test('callback state cannot be used by a second session of the same user',async t=>{
 const f=await setup(t);await f.connect();const url=new URL(f.redirect);url.searchParams.set('connected','instagram');url.searchParams.set('profileId',profile);url.searchParams.set('accountId',remote);
 const cookie='fn_session='+await sessionFor('u',f.env);const response=await runtime.fetch(new Request(url,{headers:{cookie}}),f.env);assert.equal(response.status,403);assert.equal((await f.db.prepare('SELECT count(*) n FROM instagram_accounts').first()).n,0);
});
test('an existing Meta account and another tenant cannot be silently adopted by Zernio callback',async t=>{
 for(const foreign of [false,true]){
  const f=await setup(t);if(foreign)f.db.sqlite.exec("INSERT INTO workspaces(id,name,owner_id) VALUES('foreign','Other','u')");
  await f.db.prepare("INSERT INTO instagram_accounts(id,workspace_id,username,ig_user_id,status) VALUES('existing',?,'gilberto.rebuild','123','connected')").bind(foreign?'foreign':'w').run();await f.connect();assert.equal((await f.callback()).status,409);assert.equal((await f.db.prepare('SELECT count(*) n FROM instagram_accounts').first()).n,1);
 }
});
test('rich replies use the documented Zernio fields and return its confirmed message IDs',async t=>{
 const f=await setup(t),account=await f.connected(),event={kind:'dm',sender_id:'222',at:Date.now(),conversation_id:'opaque-thread'};
 for(const action of [{type:'image',url:'https://example.com/image.jpg'},{type:'video',url:'https://example.com/video.mp4'},{type:'message',text:'Qual?',quick_replies:[{title:'Sim',payload:'YES'}]},{type:'buttons',text:'Escolha',buttons:[{type:'web_url',title:'Abrir',url:'https://example.com/'},{type:'postback',title:'Sim',payload:'YES'}]}])assert.equal(await sendAction(f.env,account,event,action),'dm-message');
 const bodies=f.calls.filter(c=>c.url.pathname.endsWith('/messages')).map(c=>c.body);assert.equal(bodies[0].attachmentType,'image');assert.equal(bodies[1].attachmentType,'video');assert.equal(bodies[2].quickReplies[0].payload,'YES');assert.equal(bodies[3].template.elements[0].buttons[0].type,'url');
});
test('a delayed signed disconnect does not invalidate an active reconnection',async t=>{
 const f=await setup(t);await f.connected();const body={event:'account.disconnected',account:{accountId:remote,platform:'instagram',profileId:profile}};
 assert.equal((await f.webhook(body)).status,200);assert.equal((await f.db.prepare('SELECT status FROM instagram_accounts').first()).status,'connected');
 const fetcher=f.env.ZERNIO_FETCH;f.env.ZERNIO_FETCH=(u,o)=>new URL(u).pathname==='/api/v1/accounts'?Promise.resolve(Response.json({accounts:[]})):fetcher(u,o);
 assert.equal((await f.webhook(body)).status,200);assert.equal((await f.db.prepare('SELECT status FROM instagram_accounts').first()).status,'reconnect_required');
});
