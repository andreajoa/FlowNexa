import test from 'node:test';
import assert from 'node:assert/strict';
import {identityDatabase} from './identity-helper.js';
import {refreshAccounts,deauthorize} from '../src/account-lifecycle.js';
import {encryptToken,decryptToken} from '../src/instagram-oauth.js';
const key='a'.repeat(64),secret='meta-app-secret-mock',now=()=>Math.floor(Date.now()/1000);
async function setup(t){const db=identityDatabase();t.after(()=>db.close());await db.prepare('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)').bind('user','owner@example.test','unused').run();await db.prepare('INSERT INTO workspaces(id,name,owner_id) VALUES(?,?,?)').bind('workspace','Workspace','user').run();return{db,env:{DB:db,TOKEN_ENCRYPTION_KEY:key,META_APP_SECRET:secret}};}
async function account(db,id='a',expiry=now()+86400){await db.prepare("INSERT INTO instagram_accounts(id,workspace_id,username,ig_user_id,encrypted_token,token_expires_at,status) VALUES(?,?,?,?,?,?,'connected')").bind(id,'workspace','account-'+id,id==='a'?'12345':'67890'+id,await encryptToken('old-token-'+id,key),expiry).run();await db.prepare("INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES(?,?,?,?,'comment_any','all','{}',1)").bind('flow-'+id,'workspace',id,'Example').run();}
async function signed(payload,signingSecret=secret){const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(signingSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=Buffer.from(await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode(encoded))).toString('base64url');return signature+'.'+encoded;}
const callback=signedRequest=>new Request('https://flownex.online/api/instagram/deauthorize',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({signed_request:signedRequest})});
test('refresh uses official endpoint, rotates encrypted token and respects two-account bound',async t=>{
 const{db,env}=await setup(t);for(const id of ['a','b','c'])await account(db,id);let calls=0;
 env.META_FETCH=async(url,options)=>{assert.equal(url.origin,'https://graph.instagram.com');assert.equal(url.pathname,'/refresh_access_token');assert.equal(url.searchParams.get('grant_type'),'ig_refresh_token');assert.match(url.searchParams.get('access_token'),/^old-token-/);assert.equal(options.method,'GET');calls++;return Response.json({access_token:'new-token-'+calls,expires_in:5184000})};
 const result=await refreshAccounts(env);assert.equal(result.checked,2);assert.equal(result.refreshed,2);assert.equal(calls,2);
 const refreshed=await db.prepare("SELECT encrypted_token,token_expires_at FROM instagram_accounts WHERE id='a'").first();assert.equal(await decryptToken(refreshed.encrypted_token,key),'new-token-1');assert.ok(refreshed.token_expires_at>now()+50*86400);
 const untouched=await db.prepare("SELECT encrypted_token FROM instagram_accounts WHERE id='c'").first();assert.equal(await decryptToken(untouched.encrypted_token,key),'old-token-c');
});
test('transient and malformed refresh responses preserve existing account token and flows',async t=>{
 const{db,env}=await setup(t);await account(db);const before=await db.prepare('SELECT * FROM instagram_accounts').first();
 for(const response of [{status:503,data:{error:{code:2}}},{status:200,data:{access_token:'bad',expires_in:-1}},{status:200,data:{access_token:'bad',expires_in:'5184000'}},{status:200,data:{access_token:'bad',expires_in:100}}]){
  env.META_FETCH=async()=>Response.json(response.data,{status:response.status});assert.equal((await refreshAccounts(env)).failed,1);assert.deepEqual(await db.prepare('SELECT * FROM instagram_accounts').first(),before);assert.equal((await db.prepare('SELECT enabled FROM flows').first()).enabled,1);
 }
 env.META_FETCH=async()=>{throw Error('network failure containing token must never be logged')};assert.equal((await refreshAccounts(env)).failed,1);assert.deepEqual(await db.prepare('SELECT * FROM instagram_accounts').first(),before);
});
test('code190 and already expired credentials require reconnect and pause flows',async t=>{
 const{db,env}=await setup(t);await account(db);await account(db,'b',now()-10);let calls=0;env.META_FETCH=async()=>{calls++;return Response.json({error:{code:190}},{status:400})};
 const result=await refreshAccounts(env);assert.equal(result.reconnect_required,2);assert.equal(calls,1);
 const rows=(await db.prepare('SELECT status,encrypted_token,token_expires_at FROM instagram_accounts').all()).results;assert.ok(rows.every(row=>row.status==='reconnect_required'&&row.encrypted_token===null&&row.token_expires_at===null));assert.ok((await db.prepare('SELECT enabled FROM flows').all()).results.every(row=>row.enabled===0));
});
test('verified deauthorization clears only matching account and idempotently pauses its flows',async t=>{
 const{db,env}=await setup(t);await account(db);await account(db,'b');const payload=await signed({algorithm:'HMAC-SHA256',user_id:'12345',issued_at:now()});
 assert.equal((await deauthorize(callback(payload),env)).status,200);assert.equal((await deauthorize(callback(payload),env)).status,200);
 const a=await db.prepare("SELECT status,encrypted_token,token_expires_at FROM instagram_accounts WHERE id='a'").first();assert.deepEqual({...a},{status:'revoked',encrypted_token:null,token_expires_at:null});assert.equal((await db.prepare("SELECT enabled,version FROM flows WHERE id='flow-a'").first()).version,2);assert.equal((await db.prepare("SELECT enabled FROM flows WHERE id='flow-a'").first()).enabled,0);assert.equal((await db.prepare("SELECT status FROM instagram_accounts WHERE id='b'").first()).status,'connected');assert.equal((await db.prepare("SELECT enabled FROM flows WHERE id='flow-b'").first()).enabled,1);
});
test('invalid signature, tampered payload, invalid algorithm, user and methods fail closed',async t=>{
 const{db,env}=await setup(t);await account(db);const valid=await signed({algorithm:'HMAC-SHA256',user_id:'12345'});
 for(const invalid of [await signed({algorithm:'HMAC-SHA256',user_id:'12345'},'wrong-secret'),valid.split('.')[0]+'.'+Buffer.from(JSON.stringify({algorithm:'HMAC-SHA256',user_id:'67890'})).toString('base64url'),await signed({algorithm:'none',user_id:'12345'}),await signed({algorithm:'HMAC-SHA256',user_id:12345}),'malformed'])assert.equal((await deauthorize(callback(invalid),env)).status,403);
 assert.equal((await deauthorize(new Request('https://flownex.online/api/instagram/deauthorize'),env)).status,405);
 assert.equal((await deauthorize(new Request('https://flownex.online/api/instagram/deauthorize',{method:'POST',body:'{}',headers:{'content-type':'application/json'}}),env)).status,415);
 assert.equal((await deauthorize(callback(valid),{DB:db})).status,503);assert.equal((await db.prepare('SELECT status FROM instagram_accounts').first()).status,'connected');assert.equal((await db.prepare('SELECT enabled FROM flows').first()).enabled,1);
});
test('oversized streamed deauthorization body rejected without content-length',async t=>{
 const{db,env}=await setup(t);await account(db);const request=new Request('https://flownex.online/api/instagram/deauthorize',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('signed_request='+'x'.repeat(17000)));controller.close()}}),duplex:'half'});assert.equal((await deauthorize(request,env)).status,413);assert.equal((await db.prepare('SELECT enabled FROM flows').first()).enabled,1);
});
test('refresh finishing after deauthorization never resurrects revoked credentials',async t=>{
 const{db,env}=await setup(t);await account(db);env.META_FETCH=async()=>{assert.equal((await deauthorize(callback(await signed({algorithm:'HMAC-SHA256',user_id:'12345'})),env)).status,200);return Response.json({access_token:'new-but-revoked',expires_in:5184000})};const result=await refreshAccounts(env);assert.equal(result.skipped,1);assert.equal(result.refreshed,0);const row=await db.prepare('SELECT status,encrypted_token FROM instagram_accounts').first();assert.equal(row.status,'revoked');assert.equal(row.encrypted_token,null);
});
test('deauthorization transaction failure rolls back flow and account updates',async t=>{
 const{db,env}=await setup(t);await account(db);db.sqlite.exec("CREATE TRIGGER reject_revoke BEFORE UPDATE OF status ON instagram_accounts WHEN NEW.status='revoked' BEGIN SELECT RAISE(ABORT,'simulate database write failure'); END;");const response=await deauthorize(callback(await signed({algorithm:'HMAC-SHA256',user_id:'12345'})),env);assert.equal(response.status,503);assert.equal((await db.prepare('SELECT enabled FROM flows').first()).enabled,1);assert.equal((await db.prepare('SELECT status FROM instagram_accounts').first()).status,'connected');
});
