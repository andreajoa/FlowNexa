import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import runtime from '../src/index.js';
import {sendAction} from '../src/meta-client.js';
import {identityDatabase} from './identity-helper.js';import {encryptToken,decryptToken} from '../src/instagram-oauth.js';import {enqueueWebhook,processPending} from '../src/automation-engine.js';import {processConversations} from '../src/conversation-runtime.js';import {validateGraph} from '../src/conversation-graph.js';
const graph=()=>({version:1,start:'question',nodes:[{id:'question',type:'message',text:'Qual produto você procura?',next:'wait'},{id:'wait',type:'wait_reply',timeout_seconds:60,on_reply:'choice',on_timeout:'followup'},{id:'choice',type:'condition',operator:'contains',value:'vestido',yes:'dress',no:'other'},{id:'dress',type:'message',text:'Veja nossos vestidos.',next:'end'},{id:'other',type:'message',text:'Nossa equipe pode ajudar.',next:'end'},{id:'followup',type:'message',text:'Posso ajudar na escolha?',next:'end'},{id:'end',type:'end'}]});
const dm=(mid,text='INICIAR',at=Date.now())=>({object:'instagram',entry:[{id:'100',messaging:[{sender:{id:'200'},recipient:{id:'100'},timestamp:at,message:{mid,text}}]}]});
const comment=()=>({object:'instagram',entry:[{id:'100',time:Date.now(),changes:[{field:'comments',value:{id:'300',from:{id:'200'},media:{id:'400'},text:'INICIAR'}}]}]});
async function setup(t,trigger='dm_keyword',g=graph()){
 const db=identityDatabase();for(const file of ['0005_runtime.sql','0008_conversations.sql'])db.sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));t.after(()=>db.close());db.sqlite.exec("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('u','owner@example.test','unused',1);INSERT INTO workspaces(id,name,owner_id) VALUES('w','Workspace','u');INSERT INTO memberships VALUES('w','u','owner');");
 const env={DB:db,TOKEN_ENCRYPTION_KEY:'a'.repeat(64),MESSAGING_ENABLED:'true',META_APP_ID:'app',META_APP_SECRET:'appsecret',META_WEBHOOK_SECRET:'parentsecret'},sent=[];
 await db.prepare("INSERT INTO instagram_accounts(id,workspace_id,username,ig_user_id,encrypted_token,token_expires_at,status) VALUES('a','w','brand','100',?,?,'connected')").bind(await encryptToken('mocktoken',env.TOKEN_ENCRYPTION_KEY),Date.now()/1000+864000).run();await db.prepare("INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES('f','w','a','Conversation',?,'all',?,1)").bind(trigger,JSON.stringify({keywords:['INICIAR'],graph:g})).run();env.META_FETCH=async(url,options)=>{if(options.method==='POST'){sent.push(JSON.parse(options.body));return Response.json({message_id:'mid-'+sent.length})}return Response.json({id:'300',timestamp:new Date().toISOString()});};return{db,env,sent};
}
async function ingest(env,body){await enqueueWebhook(body,env);await processPending(env);await processConversations(env);}
const session=db=>db.prepare('SELECT * FROM conversation_sessions ORDER BY created_at LIMIT 1').first();
test('graph validation rejects cycles, dangling edges, unreachable nodes and oversized waits',()=>{assert.equal(validateGraph(graph()).ok,true);for(const mutate of [g=>g.nodes[0].next='question',g=>g.nodes[0].next='missing',g=>g.nodes.push({id:'orphan',type:'end'}),g=>g.nodes[1].timeout_seconds=259201]){const g=graph();mutate(g);assert.equal(validateGraph(g).ok,false);}});
test('actual queued inbound DM asks a question, waits durably and branches on the next normalized user reply',async t=>{
 const{db,env,sent}=await setup(t);await ingest(env,dm('start'));assert.equal(sent.length,1);assert.equal((await session(db)).status,'waiting_reply');assert.equal(sent[0].message.text,'Qual produto você procura?');
 const before=await session(db);assert.ok(!before.encrypted_state.includes('INICIAR'));const state=JSON.parse(await decryptToken(before.encrypted_state,env.TOKEN_ENCRYPTION_KEY));assert.equal(state.graph.start,'question');
 await ingest(env,dm('answer','Quero um VESTIDO'));assert.equal(sent.length,2);assert.equal(sent[1].message.text,'Veja nossos vestidos.');assert.equal((await session(db)).status,'completed');assert.equal((await db.prepare('SELECT COUNT(*) n FROM conversation_inbound').first()).n,1);assert.equal((await db.prepare("SELECT COUNT(*) n FROM automation_jobs WHERE status='accepted'").first()).n,2);
 await ingest(env,dm('answer','Quero um VESTIDO'));assert.equal(sent.length,2);
});
test('condition no branch and timer followup are real sends within an existing user window',async t=>{
 const a=await setup(t);await ingest(a.env,dm('start'));await ingest(a.env,dm('reply','camisa'));assert.equal(a.sent[1].message.text,'Nossa equipe pode ajudar.');
 const b=await setup(t);await ingest(b.env,dm('otherstart'));b.db.sqlite.exec('UPDATE conversation_sessions SET due_at=0');await processConversations(b.env);assert.equal(b.sent[1].message.text,'Posso ajudar na escolha?');assert.equal((await session(b.db)).status,'completed');
});
test('comment first private reply never opens followup permission without a real user DM',async t=>{
 const{db,env,sent}=await setup(t,'comment_keyword');await ingest(env,comment());assert.deepEqual(sent[0].recipient,{comment_id:'300'});assert.equal(sent.length,1);db.sqlite.exec('UPDATE conversation_sessions SET due_at=0');await processConversations(env);assert.equal(sent.length,1);assert.equal((await session(db)).error,'no_reply_no_message_window');
});
test('comment conversation resumes with user DM and uses recipient ID for subsequent message',async t=>{
 const{db,env,sent}=await setup(t,'comment_keyword');await ingest(env,comment());await ingest(env,dm('answer','vestido'));assert.equal(sent.length,2);assert.deepEqual(sent[1].recipient,{id:'200'});assert.equal((await session(db)).status,'completed');
});
test('delay is durable and cannot send outside the last genuine inbound 24-hour window',async t=>{
 const g={version:1,start:'first',nodes:[{id:'first',type:'message',text:'Question',next:'delay'},{id:'delay',type:'delay',seconds:60,next:'next'},{id:'next',type:'message',text:'Followup',next:'end'},{id:'end',type:'end'}]};const{db,env,sent}=await setup(t,'dm_keyword',g);await ingest(env,dm('start'));assert.equal((await session(db)).status,'delayed');assert.equal(sent.length,1);let row=await session(db);const state=JSON.parse(await decryptToken(row.encrypted_state,env.TOKEN_ENCRYPTION_KEY));state.inbound.at=Date.now()-86400001;await db.prepare('UPDATE conversation_sessions SET encrypted_state=?,due_at=0').bind(await encryptToken(JSON.stringify(state),env.TOKEN_ENCRYPTION_KEY)).run();await processConversations(env);assert.equal(sent.length,1);assert.equal((await session(db)).error,'message_window_expired');
});
test('pause, version change, disconnect and billing enforcement cancel durable conversations',async t=>{
 for(const mutation of ["UPDATE flows SET enabled=0","UPDATE flows SET version=version+1","UPDATE instagram_accounts SET status='disconnected'"]){const{db,env,sent}=await setup(t);await ingest(env,dm('start'));db.sqlite.exec(mutation+';UPDATE conversation_sessions SET due_at=0');await processConversations(env);assert.equal(sent.length,1);assert.equal((await session(db)).status,'cancelled');}
 const{db,env,sent}=await setup(t);await ingest(env,dm('start'));env.BILLING_ENFORCED='true';db.sqlite.exec('UPDATE conversation_sessions SET due_at=0');await processConversations(env);assert.equal(sent.length,1);assert.equal((await session(db)).status,'cancelled');
});
test('uncertain message result is never retried and never advances to a later message',async t=>{
 const{db,env,sent}=await setup(t);env.META_FETCH=async()=>{sent.push('attempt');throw new TypeError('lost connection')};await ingest(env,dm('start'));assert.equal(sent.length,1);assert.equal((await session(db)).status,'unknown');await processConversations(env);await ingest(env,dm('start'));assert.equal(sent.length,1);assert.equal((await db.prepare('SELECT status FROM automation_jobs').first()).status,'unknown');
});
test('accepted job survives cursor interruption without duplicating the provider effect',async t=>{
 const{db,env,sent}=await setup(t);await ingest(env,dm('start'));let row=await session(db);let state=JSON.parse(await decryptToken(row.encrypted_state,env.TOKEN_ENCRYPTION_KEY));state.sentFirst=false;await db.prepare("UPDATE conversation_sessions SET node_id='question',step_index=0,status='running',due_at=0,encrypted_state=?").bind(await encryptToken(JSON.stringify(state),env.TOKEN_ENCRYPTION_KEY)).run();await processConversations(env);assert.equal(sent.length,1);assert.equal((await session(db)).status,'waiting_reply');
});
test('overlapping consumers and replayed inbound events cannot send or branch twice',async t=>{
 const{db,env,sent}=await setup(t);await enqueueWebhook(dm('start'),env);await processPending(env);await Promise.all([processConversations(env),processConversations(env)]);assert.equal(sent.length,1);await Promise.all([enqueueWebhook(dm('reply','vestido'),env),enqueueWebhook(dm('reply','vestido'),env)]);await Promise.all([processPending(env),processPending(env)]);await Promise.all([processConversations(env),processConversations(env)]);assert.equal(sent.length,2);assert.equal((await db.prepare('SELECT COUNT(*) n FROM conversation_inbound').first()).n,1);
});
test('old delayed inbound does not answer a later question and original event retries do not resume its own wait',async t=>{
 const{db,env,sent}=await setup(t);await ingest(env,dm('start'));db.sqlite.exec("UPDATE automation_events SET status='pending',due_at=0");await processPending(env);await processConversations(env);assert.equal(sent.length,1);assert.equal((await session(db)).status,'waiting_reply');await ingest(env,dm('older','vestido',Date.now()-60000));assert.equal(sent.length,1);assert.equal((await session(db)).status,'waiting_reply');
});

test('signed Instagram HTTP webhook drives the full queued multi-turn conversation; forged HMAC never enters it',async t=>{
 const{db,env,sent}=await setup(t);
 async function post(payload,valid=true){const text=JSON.stringify(payload),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(valid?env.META_WEBHOOK_SECRET:'wrong'),{name:'HMAC',hash:'SHA-256'},false,['sign']),signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))).toString('hex');return runtime.fetch(new Request('https://flownex.online/webhooks/instagram',{method:'POST',headers:{'x-hub-signature-256':'sha256='+signature,'content-type':'application/json'},body:text}),env);}
 assert.equal((await post(dm('forged'),false)).status,403);assert.equal((await db.prepare('SELECT COUNT(*) n FROM automation_events').first()).n,0);
 assert.equal((await post(dm('realstart'))).status,200);await processPending(env);await processConversations(env);assert.equal(sent.length,1);
 assert.equal((await post(dm('realanswer','vestido'))).status,200);await processPending(env);await processConversations(env);assert.equal(sent.length,2);assert.equal(sent[1].message.text,'Veja nossos vestidos.');assert.equal((await session(db)).status,'completed');
});

test('a delayed older DM cannot answer a second wait or reuse its previous reply',async t=>{
 const g={version:1,start:'q1',nodes:[{id:'q1',type:'message',text:'Q1',next:'w1'},{id:'w1',type:'wait_reply',timeout_seconds:60,on_reply:'q2',on_timeout:'end'},{id:'q2',type:'message',text:'Q2',next:'w2'},{id:'w2',type:'wait_reply',timeout_seconds:60,on_reply:'q3',on_timeout:'end'},{id:'q3',type:'message',text:'Q3',next:'end'},{id:'end',type:'end'}]};
 const{db,env,sent}=await setup(t,'dm_keyword',g);await ingest(env,dm('start'));const time=Date.now();await ingest(env,dm('first-answer','first',time));assert.equal((await session(db)).node_id,'w2');assert.equal(sent.length,2);await ingest(env,dm('older-answer','older',time-1));assert.equal(sent.length,2);assert.equal((await session(db)).status,'waiting_reply');assert.equal((await session(db)).node_id,'w2');
});
test('two replies in one pending batch cannot overwrite the answer already bound to its condition',async t=>{
 const{db,env,sent}=await setup(t);await ingest(env,dm('start'));const first=Date.now();await enqueueWebhook(dm('answer-first','vestido',first),env);await enqueueWebhook(dm('answer-second','camisa',first+1),env);await processPending(env);await processConversations(env);assert.equal(sent.length,2);assert.equal(sent[1].message.text,'Veja nossos vestidos.');const state=JSON.parse(await decryptToken((await session(db)).encrypted_state,env.TOKEN_ENCRYPTION_KEY));assert.equal(state.replyText,'vestido');assert.equal(state.inbound.text,'camisa');
});

test('reply received after provider acceptance survives an interrupted graph cursor advance',async t=>{
 const{db,env,sent}=await setup(t),original=db.prepare;let injected=false;
 db.prepare=sql=>{const statement=original(sql);if(sql.startsWith('UPDATE conversation_sessions SET encrypted_state='))return{bind(...values){const bound=statement.bind(...values);return{...bound,async run(){if(!injected&&values[1]==='wait'&&values[3]==='running'){injected=true;throw Error('cursor persistence unavailable after accepted message');}return bound.run();}};}};return statement;};
 await ingest(env,dm('start'));assert.equal(sent.length,1);assert.equal((await session(db)).node_id,'question');assert.equal((await db.prepare('SELECT status FROM automation_jobs').first()).status,'accepted');
 await enqueueWebhook(dm('answer-during-recovery','vestido'),env);await processPending(env);db.sqlite.exec('UPDATE conversation_sessions SET due_at=0');await processConversations(env);assert.equal(sent.length,2);assert.equal(sent[1].message.text,'Veja nossos vestidos.');assert.equal((await session(db)).status,'completed');
});
test('one absolute Meta deadline prevents POST when the private-comment GET exhausts its budget',async t=>{
 const{db,env}=await setup(t,'comment_keyword');const account=await db.prepare('SELECT * FROM instagram_accounts').first();env.RUNTIME_DEADLINE_MS=Date.now()+10000;let gets=0,posts=0;env.META_FETCH=async(url,options)=>{if(options.method==='POST')posts++;else gets++;env.RUNTIME_DEADLINE_MS=Date.now()-1;return Response.json({id:'300',timestamp:new Date().toISOString()});};await assert.rejects(()=>sendAction(env,account,{kind:'comment',comment_id:'300',sender_id:'200',at:Date.now()},{type:'private_reply',text:'Question'}),error=>error.deferred===true&&error.message==='processing_deferred');assert.equal(gets,1);assert.equal(posts,0);
});
test('an exhausted execution deadline defers before any Meta request instead of classifying an unsent message as unknown',async t=>{
 const{db,env}=await setup(t);const account=await db.prepare('SELECT * FROM instagram_accounts').first();env.RUNTIME_DEADLINE_MS=Date.now()-1;let calls=0;env.META_FETCH=async()=>{calls++;return Response.json({message_id:'must-not-send'});};await assert.rejects(()=>sendAction(env,account,{kind:'dm',sender_id:'200',at:Date.now()},{type:'message',text:'Question'}),error=>error.deferred===true);assert.equal(calls,0);
});
