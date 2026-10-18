import test from 'node:test';
import assert from 'node:assert/strict';
import {identityDatabase} from './identity-helper.js';
import {sessionFor} from '../src/identity.js';
import {instagramOauth, decryptToken} from '../src/instagram-oauth.js';

const origin='https://flownex.online', key='a'.repeat(64);
async function setup(t,{wrapped=false,exchangeFails=false}={}){
 const db=identityDatabase();t.after(()=>db.close());
 await db.prepare('INSERT INTO users(id,email,password_hash,email_verified_at) VALUES(?,?,?,?)').bind('owner','owner@example.test','unused',1).run();
 await db.prepare('INSERT INTO workspaces(id,name,owner_id) VALUES(?,?,?)').bind('workspace','Workspace','owner').run();
 await db.prepare('INSERT INTO memberships(workspace_id,user_id,role) VALUES(?,?,?)').bind('workspace','owner','owner').run();
 const env={DB:db,META_APP_ID:'app-id',META_APP_SECRET:'app-secret',META_REDIRECT_URI:origin+'/api/instagram/callback',META_API_VERSION:'v24.0',TOKEN_ENCRYPTION_KEY:key,OAUTH_LOG:()=>{}};
 const cookie='fn_session='+await sessionFor('owner',env),calls=[];
 env.META_FETCH=async(input,options={})=>{
  const url=new URL(input),method=options.method||'GET';calls.push({url,options});
  if(url.hostname==='api.instagram.com'&&url.pathname==='/oauth/access_token'){
   assert.equal(method,'POST');const data={access_token:'short-token',user_id:'12345',permissions:['instagram_business_basic','instagram_business_manage_messages','instagram_business_manage_comments']};
   return Response.json(wrapped?{data:[data]}:data);
  }
  if(url.pathname==='/access_token')return exchangeFails?Response.json({error:{message:'Unsupported request - method type: get'}},{status:400}):Response.json({access_token:'long-token',expires_in:5184000});
  // Reproduce the provider rejection of the legacy, unversioned profile route.
  if(url.pathname==='/me')return Response.json({error:{message:'Unsupported request - method type: get'}},{status:400});
  if(url.pathname==='/v24.0/me')return Response.json({id:'app-scoped-id',user_id:'12345',username:'gilberto.rebuild'});
  if(url.pathname==='/v24.0/me/subscribed_apps'){assert.equal(method,'POST');return Response.json({success:true});}
  throw Error('Unexpected provider route: '+url.pathname);
 };
 const request=path=>new Request(origin+path,{headers:{cookie}});
 async function connect(){const r=await instagramOauth(request('/api/instagram/connect?workspace=workspace'),env);assert.equal(r.status,200);return new URL((await r.json()).authorization_url);}
 async function callback(auth=undefined){auth||=await connect();return instagramOauth(request('/api/instagram/callback?'+new URLSearchParams({state:auth.searchParams.get('state'),code:'authorization-code'})),env);}
 return{db,env,calls,request,connect,callback};
}

test('callback connects gilberto.rebuild through versioned profile API despite legacy GET rejection',async t=>{
 const{db,callback,calls}=await setup(t);const response=await callback();
 assert.equal(response.status,302,await response.clone().text());
 const account=await db.prepare('SELECT * FROM instagram_accounts').first();assert.equal(account.username,'gilberto.rebuild');assert.equal(account.ig_user_id,'12345');assert.equal(account.status,'connected');assert.equal(await decryptToken(account.encrypted_token,key),'long-token');
 assert.ok(account.token_expires_at>Date.now()/1000+50*86400);
 assert.equal(calls.filter(c=>c.url.pathname==='/me').length,0);
});
test('callback accepts Instagram wrapped token response',async t=>{const{callback}=await setup(t,{wrapped:true});const response=await callback();assert.equal(response.status,302,await response.clone().text());});
test('failed long-lived exchange never saves a short-lived token as a durable connection',async t=>{
 const{db,callback,calls}=await setup(t,{exchangeFails:true});const response=await callback();
 assert.equal(response.status,502);assert.equal((await response.json()).error,'long_token_exchange_failed');assert.equal((await db.prepare('SELECT count(*) n FROM instagram_accounts').first()).n,0);assert.equal(calls.some(c=>c.url.pathname.endsWith('/subscribed_apps')),false);
});

test('authorization supports choosing another account and uses complete business permissions',async t=>{
 const{connect}=await setup(t);const auth=await connect();assert.equal(auth.origin,'https://www.instagram.com');assert.equal(auth.searchParams.get('force_authentication'),'1');assert.equal(auth.searchParams.get('enable_fb_login'),'0');assert.equal(auth.searchParams.get('redirect_uri'),origin+'/api/instagram/callback');assert.equal(auth.searchParams.get('scope'),'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments');
});
test('state is single use, session-bound, expires, and requires current administrative membership',async t=>{
 const{env,db,request,connect,callback,calls}=await setup(t);let auth=await connect();assert.equal((await callback(auth)).status,302);let count=calls.length;assert.equal((await callback(auth)).status,403);assert.equal(calls.length,count);
 auth=await connect();db.sqlite.exec('UPDATE oauth_states SET expires_at=0');assert.equal((await callback(auth)).status,403);
 auth=await connect();const other=await sessionFor('owner',env);assert.equal((await instagramOauth(new Request(origin+'/api/instagram/callback?'+new URLSearchParams({state:auth.searchParams.get('state'),code:'code'}),{headers:{cookie:'fn_session='+other}}),env)).status,403);
 db.sqlite.exec("UPDATE memberships SET role='viewer'");assert.equal((await callback(auth)).status,403);assert.equal((await instagramOauth(request('/api/instagram/connect?workspace=workspace'),env)).status,403);
});
test('browser cancellation consumes state and returns a safe error to the app',async t=>{
 const{env,db,connect,request,calls}=await setup(t);const auth=await connect();const req=request('/api/instagram/callback?'+new URLSearchParams({state:auth.searchParams.get('state'),error:'access_denied',error_description:'sensitive-provider-data'}));req.headers.set('accept','text/html');const r=await instagramOauth(req,env);
 assert.equal(r.status,302);assert.equal(r.headers.get('location'),origin+'/app?error=authorization_declined');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(calls.length,0);assert.equal((await db.prepare('SELECT count(*) n FROM oauth_states').first()).n,0);
});
test('missing permissions, malformed tokens, profile ID and provider failures never save accounts or leak credentials',async t=>{
 const cases=[
  ['/oauth/access_token',{access_token:'short-token',permissions:['instagram_business_basic']},200,'instagram_permissions_missing'],
  ['/oauth/access_token',{data:[{access_token:'a'},{access_token:'b'}]},200,'token_exchange_failed'],
  ['/access_token',{access_token:'invalid-lifetime',expires_in:-1},200,'long_token_exchange_failed'],
  ['/access_token',{access_token:'invalid-lifetime',expires_in:'5184000'},200,'long_token_exchange_failed'],
  ['/v24.0/me',{id:'12345',username:'brand'},200,'instagram_profile_failed'],
  ['/v24.0/me',{error:{message:'do not leak long-token app-secret'}},400,'instagram_profile_failed'],
  ['/v24.0/me/subscribed_apps',{success:false},200,'instagram_subscription_failed'],
 ];
 for(const[path,data,status,error]of cases){
  const{env,db,callback}=await setup(t);const fetcher=env.META_FETCH;env.META_FETCH=(u,o)=>new URL(u).pathname===path?Promise.resolve(Response.json(data,{status})):fetcher(u,o);
  const r=await callback(),text=await r.text();assert.equal(JSON.parse(text).error,error);assert.doesNotMatch(text,/long-token|app-secret/);assert.equal((await db.prepare('SELECT count(*) n FROM instagram_accounts').first()).n,0);
 }
});
test('reconnection updates the same record and preserves the original workspace',async t=>{
 const{db,callback}=await setup(t);assert.equal((await callback()).status,302);const before=await db.prepare('SELECT id FROM instagram_accounts').first();assert.equal((await callback()).status,302);assert.equal((await db.prepare('SELECT id FROM instagram_accounts').first()).id,before.id);
 await db.prepare('INSERT INTO workspaces(id,name,owner_id) VALUES(?,?,?)').bind('other','Other','owner').run();db.sqlite.exec("UPDATE instagram_accounts SET workspace_id='other'");assert.equal((await callback()).status,409);assert.equal((await db.prepare('SELECT workspace_id FROM instagram_accounts').first()).workspace_id,'other');
});
test('unexpected network errors are sanitized and HTML navigations return to the app',async t=>{
 const{env,connect,request}=await setup(t);const auth=await connect();env.META_FETCH=async()=>{throw Error('https://provider.example/?access_token=secret')};const r=request('/api/instagram/callback?'+new URLSearchParams({state:auth.searchParams.get('state'),code:'code'}));r.headers.set('accept','text/html');const response=await instagramOauth(r,env);assert.equal(response.status,302);assert.equal(new URL(response.headers.get('location')).searchParams.get('error'),'instagram_connection_failed');assert.match(new URL(response.headers.get('location')).searchParams.get('connection_ref'),/^[a-f0-9-]{36}$/);
});

test('provider failures emit only safe stage metadata with a support reference',async t=>{
 const{env,callback}=await setup(t);const logs=[],fetcher=env.META_FETCH;env.OAUTH_LOG=line=>logs.push(JSON.parse(line));env.META_FETCH=(u,o)=>new URL(u).pathname==='/v24.0/me'?Promise.resolve(Response.json({error:{code:100,error_subcode:33,fbtrace_id:'safe-trace-123',message:'Unsupported request - method type: get secret long-token app-secret'}},{status:400})):fetcher(u,o);
 const r=await callback(),data=await r.json();assert.equal(data.error,'instagram_profile_failed');assert.equal(logs.length,1);assert.equal(logs[0].reference,data.reference);assert.equal(logs[0].step,'profile');assert.equal(logs[0].provider_code,100);assert.equal(logs[0].unsupported_get,true);assert.doesNotMatch(JSON.stringify(logs),/long-token|app-secret|access_token|https:/);
});

test('exchange rejection with real Meta code100 is classified without reaching profile',async t=>{
 const{env,db,callback,calls}=await setup(t);const fetcher=env.META_FETCH,logs=[];env.OAUTH_LOG=line=>logs.push(JSON.parse(line));
 env.META_FETCH=(url,options)=>new URL(url).pathname==='/access_token'?Promise.resolve(Response.json({error:{message:'Unsupported request - method type: get',type:'IGApiException',code:100,fbtrace_id:'trace-fixture'}},{status:400})):fetcher(url,options);
 const result=await callback();assert.equal(result.status,502);assert.equal((await result.json()).error,'long_token_exchange_failed');assert.equal(logs[0].provider_code,100);assert.equal(logs[0].step,'long_token_exchange');assert.equal(logs[0].unsupported_get,true);assert.equal((await db.prepare('SELECT count(*) n FROM instagram_accounts').first()).n,0);
});
