import test from 'node:test';
import {pbkdf2Sync} from 'node:crypto';
import assert from 'node:assert/strict';
import {identityDatabase} from './identity-helper.js';
import {accountApi} from '../src/auth.js';
import {getSessionUser,requireMembership,sha,passwordHash,verifyPassword} from '../src/identity.js';
import {identityEmail} from '../src/transactional-email.js';
function setup(t){const db=identityDatabase();t.after(()=>db.close());const sent=[];const env={DB:db,RESEND_API_KEY:'mock-api-key',PUBLIC_BASE_URL:'https://flownex.online',RESEND_FETCH:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');sent.push({headers:options.headers,...JSON.parse(options.body)});return Response.json({id:'mock-'+sent.length})}};return{db,env,sent};}
const email='owner@example.test',password='Initial-password-123';
function request(path,body,cookie,extra={}){const headers={origin:'https://flownex.online','cf-connecting-ip':'192.0.2.1',...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{}),...extra};return new Request('https://flownex.online'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});}
const tokenFrom=message=>decodeURIComponent(message.text.match(/#(?:verify|reset)=([^\s]+)/)[1]);
async function register(env,locale='en'){return accountApi(request('/api/auth/register',{email,password,locale}),env);}
async function verified(env,sent){assert.equal((await register(env)).status,202);const response=await accountApi(request('/api/auth/verify-email',{token:tokenFrom(sent.at(-1))}),env);assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];}
test('registration remains unverified; email is branded, token hashed, confirmation is single use and creates secure session',async t=>{
 const{db,env,sent}=setup(t);const result=await register(env,'fr');assert.equal(result.status,202);assert.equal(result.headers.get('set-cookie'),null);
 assert.equal(sent.length,1);assert.equal(sent[0].from,'FlowNexa <hello@flownex.online>');assert.equal(sent[0].reply_to,'flownex@proton.me');assert.match(sent[0].subject,/Confirmez/);assert.match(sent[0].headers['idempotency-key'],/^flownexa-verify_email-/);
 const token=tokenFrom(sent[0]);const stored=await db.prepare('SELECT token_hash,consumed_at FROM auth_tokens').first();assert.equal(stored.token_hash,await sha(token));assert.notEqual(stored.token_hash,token);
 assert.equal((await accountApi(request('/api/auth/login',{email,password}),env)).status,403);
 assert.equal((await accountApi(request('/api/auth/verify-email?token='+token),env)).status,401);assert.equal((await db.prepare('SELECT consumed_at FROM auth_tokens').first()).consumed_at,null);
 const confirmed=await accountApi(request('/api/auth/verify-email',{token}),env);assert.equal(confirmed.status,200);assert.match(confirmed.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 const cookie=confirmed.headers.get('set-cookie').split(';')[0];assert.equal((await getSessionUser(request('/api/auth/me',null,cookie),env)).email,email);
 assert.equal((await accountApi(request('/api/auth/verify-email',{token}),env)).status,400);
});
test('password reset is single use, revokes every session and rejects expired token',async t=>{
 const{db,env,sent}=setup(t);const cookie=await verified(env,sent);
 assert.equal((await accountApi(request('/api/auth/login',{email,password}),env)).status,200);
 assert.equal((await accountApi(request('/api/auth/forgot-password',{email}),env)).status,202);const token=tokenFrom(sent.at(-1));
 assert.equal((await accountApi(request('/api/auth/reset-password',{token,password:'New-password-4567'}),env)).status,200);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);
 assert.equal(await getSessionUser(request('/api/auth/me',null,cookie),env),null);
 assert.equal((await accountApi(request('/api/auth/reset-password',{token,password:'Other-password-123'}),env)).status,400);
 assert.equal((await accountApi(request('/api/auth/login',{email,password}),env)).status,401);
 assert.equal((await accountApi(request('/api/auth/login',{email,password:'New-password-4567'}),env)).status,200);
 await accountApi(request('/api/auth/forgot-password',{email}),env);const expired=tokenFrom(sent.at(-1));await db.prepare('UPDATE auth_tokens SET expires_at=0 WHERE token_hash=?').bind(await sha(expired)).run();
 assert.equal((await accountApi(request('/api/auth/reset-password',{token:expired,password:'Third-password-987'}),env)).status,400);
});
test('DB-backed throttle persists across invocations and origin checks reject cross-site writes',async t=>{
 const{env,db}=setup(t);assert.equal((await accountApi(request('/api/auth/register',{email,password},null,{origin:'https://attacker.example'}),env)).status,403);
 for(let i=0;i<10;i++)assert.equal((await accountApi(request('/api/auth/login',{email,password}),env)).status,401);
 assert.equal((await accountApi(request('/api/auth/login',{email,password}),{...env})).status,429);
 const rows=await db.prepare('SELECT key_hash,attempts FROM auth_rate_limits').all();assert.equal(rows.results.length,2);assert.ok(rows.results.every(r=>/^[a-f0-9]{64}$/.test(r.key_hash)));
});
test('streamed oversized body is rejected even without content-length',async t=>{
 const{env}=setup(t);const response=await accountApi(new Request('https://flownex.online/api/auth/register',{method:'POST',headers:{origin:'https://flownex.online','content-type':'application/json'},body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"email":"'+'x'.repeat(13000)));controller.close()}}),duplex:'half'}),env);assert.equal(response.status,413);
});
test('memberships isolate workspaces and enforce roles; logout revokes current session',async t=>{
 const{env,db,sent}=setup(t);const cookie=await verified(env,sent);const user=await getSessionUser(request('/api/auth/me',null,cookie),env);const workspace=await db.prepare('SELECT id FROM workspaces').first();
 assert.ok(await requireMembership(db,user.id,workspace.id,['owner']));assert.equal(await requireMembership(db,user.id,workspace.id,['viewer']),null);assert.equal(await requireMembership(db,'other',workspace.id),null);
 const workspaces=await accountApi(request('/api/workspaces',null,cookie),env);assert.equal((await workspaces.json()).workspaces.length,1);
 assert.equal((await accountApi(request('/api/accounts?workspace=other',null,cookie),env)).status,403);
 assert.equal((await accountApi(request('/api/auth/logout',{},cookie),env)).status,200);assert.equal((await accountApi(request('/api/auth/me',null,cookie),env)).status,401);
});
test('unknown and existing addresses have generic recovery and registration responses',async t=>{
 const{env,sent}=setup(t);await register(env);const duplicate=await register(env);assert.deepEqual(await duplicate.json(),{ok:true,verification_required:true});assert.equal(sent.length,1);
 const known=await accountApi(request('/api/auth/resend-verification',{email}),env);const unknown=await accountApi(request('/api/auth/resend-verification',{email:'unknown@example.test'}),env);assert.equal(known.status,unknown.status);assert.deepEqual(await known.json(),await unknown.json());assert.equal(sent.length,2);
});
test('provider failure never issues a session or marks email verified and can be recovered via resend',async t=>{
 const{env,db,sent}=setup(t);const failing={...env,RESEND_FETCH:async()=>Response.json({message:'unavailable'},{status:503})};assert.equal((await register(failing)).status,503);
 assert.equal((await db.prepare('SELECT email_verified_at FROM users').first()).email_verified_at,null);assert.equal((await db.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);
 assert.equal((await accountApi(request('/api/auth/resend-verification',{email}),env)).status,202);assert.equal(sent.length,1);
});
test('expired verification links and replayed sibling links cannot authenticate',async t=>{
 const{env,db,sent}=setup(t);await register(env);const expired=tokenFrom(sent.at(-1));await db.prepare('UPDATE auth_tokens SET expires_at=0').run();assert.equal((await accountApi(request('/api/auth/verify-email',{token:expired}),env)).status,400);
 await accountApi(request('/api/auth/resend-verification',{email}),env);const first=tokenFrom(sent.at(-1));await accountApi(request('/api/auth/resend-verification',{email}),env);const second=tokenFrom(sent.at(-1));assert.equal((await accountApi(request('/api/auth/verify-email',{token:first}),env)).status,200);assert.equal((await accountApi(request('/api/auth/verify-email',{token:second}),env)).status,400);
});
test('transactional messages support all six launch languages and never inject a supplied locale',()=>{
 for(const locale of ['pt-BR','en','de','fr','es','it']){const message=identityEmail({purpose:'reset_password',locale,token:'safe-token'},{PUBLIC_BASE_URL:'https://flownex.online'});assert.match(message.html,new RegExp('lang="'+locale+'"'));assert.match(message.text,/https:\/\/flownex.online\/app#reset=safe-token/);}
 assert.match(identityEmail({purpose:'verify_email',locale:'"><script>',token:'safe'},{PUBLIC_BASE_URL:'https://flownex.online'}).html,/lang="en"/);
});
test('password hashes use versioned 600000 work factor and reject a wrong password',async()=>{const hash=await passwordHash(password);assert.match(hash,/^pbkdf2-sha256\$600000\$/);assert.equal(await verifyPassword(password,hash),true);assert.equal(await verifyPassword('different-password',hash),false);});

test('legacy 100000 versioned and 210000 unversioned hashes remain verifiable',async()=>{
 const salt='identity-legacy-test-salt';
 for(const iterations of [100000,210000]){
  const digest=pbkdf2Sync(password,salt,iterations,32,'sha256').toString('hex');
  const stored=iterations===100000?`pbkdf2-sha256$100000$${salt}$${digest}`:`${salt}:${digest}`;
  assert.equal(await verifyPassword(password,stored),true);
  assert.equal(await verifyPassword('incorrect-password-987',stored),false);
 }
 assert.equal(await verifyPassword(password,'pbkdf2-sha256$999999999$salt$'+'0'.repeat(64)),false);
});
