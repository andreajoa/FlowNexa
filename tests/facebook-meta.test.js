import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {identityDatabase} from './identity-helper.js';
import {sessionFor} from '../src/identity.js';
import {facebookApi} from '../src/facebook-api.js';
import {metaFacebookWebhook,processFacebookJobs} from '../src/facebook-runtime.js';
import {ensureFacebookSchema} from '../src/facebook-schema.js';
const origin='https://flownex.online',secret='meta-app-secret';
const graph={version:1,start:'hi',nodes:[{id:'hi',type:'message',text:'Hi! How can I help?',quick_replies:[{title:'Pricing',payload:'PRICE'}],next:'w'},{id:'w',type:'wait_reply',timeout_seconds:3600,on_reply:'r',on_timeout:'end'},{id:'r',type:'condition',operator:'contains',value:'PRICE',yes:'price',no:'end'},{id:'price',type:'buttons',text:'Plans',buttons:[{type:'web_url',title:'See plans',url:'https://www.atenza.online/precos'}],next:'end'},{id:'end',type:'end'}]};
async function fixture(t){
 const db=identityDatabase();t.after(()=>db.close());
 db.sqlite.exec("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('u','u@example.test','unused',1);INSERT INTO workspaces(id,name,owner_id) VALUES('w','Atenza','u'),('amb','AMB','u');INSERT INTO memberships VALUES('w','u','owner'),('amb','u','owner');");
 const calls=[];
 const env={DB:db,FACEBOOK_CHANNEL_ENABLED:'true',FACEBOOK_SENDS_ENABLED:'true',FACEBOOK_PILOT_WORKSPACES:'*',TOKEN_ENCRYPTION_KEY:'a'.repeat(64),FACEBOOK_APP_ID:'2210386389506759',FACEBOOK_APP_SECRET:secret,FACEBOOK_VERIFY_TOKEN:'verify-me',ZERNIO_API_KEY:'z',ZERNIO_WEBHOOK_SECRET:'z'};
 env.FACEBOOK_GRAPH_FETCH=async(input,options={})=>{const u=new URL(input);calls.push({u,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  if(u.pathname.endsWith('/oauth/access_token'))return Response.json({access_token:u.searchParams.get('grant_type')?'long-user':'short-user'});
  if(u.pathname.endsWith('/me/accounts'))return Response.json({data:[{id:'111',name:'Atenza',access_token:'page-token-111'},{id:'222',name:'Other',access_token:'page-token-222'}]});
  if(u.pathname.endsWith('/111/subscribed_apps'))return Response.json({success:true});
  if(u.pathname.endsWith('/me/messages'))return Response.json({recipient_id:'x',message_id:'m.'+calls.length});
  throw Error('unexpected '+u.pathname);};
 const cookie='fn_session='+await sessionFor('u',env);
 const request=(path,body)=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin,accept:'text/html','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return{db,env,calls,request};
}
async function connect(f){
 const start=await facebookApi(f.request('/api/facebook/connect?workspace=w'),f.env);assert.equal(start.status,200);
 const auth=new URL((await start.json()).authorization_url);
 assert.equal(auth.hostname,'www.facebook.com');assert.equal(auth.searchParams.get('client_id'),'2210386389506759');assert.equal(auth.searchParams.get('redirect_uri'),origin+'/api/facebook/meta/callback');assert.match(auth.searchParams.get('scope'),/pages_messaging/);
 const back=await facebookApi(f.request('/api/facebook/meta/callback?code=abc&state='+encodeURIComponent(auth.searchParams.get('state'))),f.env);
 assert.equal(back.status,302);assert.match(back.headers.get('location'),/facebook_select=1/);
 const pages=await(await facebookApi(f.request('/api/facebook/meta/pages?workspace=w'),f.env)).json();
 assert.deepEqual(pages,{pages:[{id:'111',name:'Atenza'},{id:'222',name:'Other'}]});
 const chosen=await facebookApi(f.request('/api/facebook/meta/select',{workspace_id:'w',page_id:'111'}),f.env);assert.equal(chosen.status,200);
}
function signed(body){const raw=JSON.stringify(body);return new Request(origin+'/webhooks/facebook',{method:'POST',headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(raw).digest('hex'),'content-type':'application/json'},body:raw});}
const dm=(mid,text,payload)=>({object:'page',entry:[{id:'111',time:Date.now(),messaging:[{sender:{id:'psid-9'},recipient:{id:'111'},timestamp:Date.now(),message:{mid,text,...(payload?{quick_reply:{payload}}:{})}}]}]});
test('new Pages connect through the Meta app: login, Page choice, webhook subscription, encrypted token',async t=>{
 const f=await fixture(t);await connect(f);
 const account=f.db.sqlite.prepare('SELECT * FROM facebook_accounts').get();
 assert.equal(account.provider,'meta');assert.equal(account.native_id,'111');assert.equal(account.name,'Atenza');assert.notEqual(account.encrypted_token,'page-token-111');assert.ok(account.encrypted_token);
 const sub=f.calls.find(c=>c.u.pathname.endsWith('/111/subscribed_apps'));assert.equal(sub.method,'POST');assert.equal(sub.u.searchParams.get('access_token'),'page-token-111');assert.match(sub.u.searchParams.get('subscribed_fields'),/messages/);
 assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM facebook_meta_pending').get().n,0);
});
test('Meta webhook verifies, rejects bad signatures and runs the conversation graph through the Graph API',async t=>{
 const f=await fixture(t);await connect(f);await ensureFacebookSchema(f.env);
 const account=f.db.sqlite.prepare('SELECT id FROM facebook_accounts').get();
 f.db.sqlite.prepare("INSERT INTO facebook_flows(id,workspace_id,account_id,name,trigger_type,response_kind,response_text,graph,enabled,created_at,updated_at) VALUES('flow','w',?,'Atenza',?,'graph','Conversa com nós',?,1,1,1)").run(account.id,'dm_any',JSON.stringify(graph));
 const verify=await metaFacebookWebhook(new Request(origin+'/webhooks/facebook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42'),f.env);assert.equal(await verify.text(),'42');
 const forged=signed(dm('m1','hi'));const bad=new Request(forged.url,{method:'POST',headers:{'x-hub-signature-256':'sha256='+'0'.repeat(64)},body:JSON.stringify(dm('m1','hi'))});assert.equal((await metaFacebookWebhook(bad,f.env)).status,401);
 assert.equal((await(await metaFacebookWebhook(signed(dm('m1','hi')),f.env)).json()).queued,1);await processFacebookJobs(f.env);
 const first=f.calls.filter(c=>c.u.pathname.endsWith('/me/messages'))[0];
 assert.equal(first.u.searchParams.get('access_token'),'page-token-111');assert.deepEqual(first.body.recipient,{id:'psid-9'});assert.equal(first.body.message.text,'Hi! How can I help?');assert.equal(first.body.message.quick_replies[0].payload,'PRICE');
 assert.equal((await(await metaFacebookWebhook(signed(dm('m2','Pricing','PRICE')),f.env)).json()).queued,1);await processFacebookJobs(f.env);
 const second=f.calls.filter(c=>c.u.pathname.endsWith('/me/messages'))[1];assert.equal(second.body.message.attachment.payload.template_type,'button');assert.equal(second.body.message.attachment.payload.buttons[0].url,'https://www.atenza.online/precos');
 const echo=dm('m3','x');echo.entry[0].messaging[0].message.is_echo=true;assert.equal((await(await metaFacebookWebhook(signed(echo),f.env)).json()).queued,0);
});
test('a Page already on Zernio keeps reconnecting through Zernio',async t=>{
 const f=await fixture(t);await ensureFacebookSchema(f.env);
 f.db.sqlite.exec("INSERT INTO facebook_accounts(id,workspace_id,remote_id,profile_id,native_id,name,status,created_at) VALUES('z','amb','abcdefabcdefabcdefabcdef','profile_z','272761639257413','AMB Boutique','connected',1)");
 assert.equal(f.db.sqlite.prepare('SELECT provider FROM facebook_accounts').get().provider,'zernio');
 const r=await facebookApi(f.request('/api/facebook/connect?workspace=amb'),f.env);assert.equal(r.status,409);assert.equal((await r.json()).error,'facebook_pilot_page_limit');
 assert.equal(f.calls.length,0);
});
test('own Meta app: credentials validated, Page subscribed, webhooks verified with that app secret',async t=>{
 const f=await fixture(t);const own='a'.repeat(32);
 const base=f.env.FACEBOOK_GRAPH_FETCH;f.env.FACEBOOK_GRAPH_FETCH=async(input,options={})=>{const u=new URL(input);if(u.pathname.endsWith('/333')&&(options.method||'GET')==='GET')return u.searchParams.get('access_token')==='own-page-token-xyz123'?Response.json({id:'333',name:'Client Shop'}):Response.json({error:{code:190}},{status:400});if(u.pathname.endsWith('/333/subscribed_apps'))return Response.json({success:true});return base(input,options);};
 assert.equal((await facebookApi(f.request('/api/facebook/byo',{workspace_id:'w',page_id:'333',page_token:'wrong-token-1234567890',app_secret:own}),f.env)).status,400);
 const ok=await facebookApi(f.request('/api/facebook/byo',{workspace_id:'w',page_id:'333',page_token:'own-page-token-xyz123',app_secret:own}),f.env);assert.equal(ok.status,200);
 const account=f.db.sqlite.prepare('SELECT * FROM facebook_accounts').get();assert.equal(account.provider,'meta_byo');assert.notEqual(account.encrypted_app_secret,own);
 const setup=await(await facebookApi(f.request('/api/facebook/byo/setup?workspace=w'),f.env)).json();assert.equal(setup.webhook_url,origin+'/webhooks/facebook');assert.equal(setup.verify_token,'verify-me');
 const body={object:'page',entry:[{id:'333',time:Date.now(),messaging:[]}]},raw=JSON.stringify(body);
 const withSecret=key=>new Request(origin+'/webhooks/facebook',{method:'POST',headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',key).update(raw).digest('hex')},body:raw});
 assert.equal((await metaFacebookWebhook(withSecret(secret),f.env)).status,401);
 assert.equal((await metaFacebookWebhook(withSecret(own),f.env)).status,200);
});
