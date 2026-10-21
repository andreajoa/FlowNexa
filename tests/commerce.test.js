import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {identityDatabase} from './identity-helper.js';
import {ensureCommerceSchema} from '../src/commerce/schema.js';
import {validateCredentials,queryStore,probeStore} from '../src/commerce/providers.js';
import {publicAddress,storeOrigin} from '../src/commerce/http.js';
import {connectStore,ownedStore,readStore,verifiedEmail,disconnectStore} from '../src/commerce/service.js';
import {issueChallenge,confirmChallenge,observeCommerceInbound,commerceNode} from '../src/commerce/customer.js';
import {commerceWebhook} from '../src/commerce/webhooks.js';
import {encryptToken} from '../src/instagram-oauth.js';
import {sha} from '../src/identity.js';
async function setup(t){const DB=identityDatabase();t.after(()=>DB.close());DB.sqlite.exec("INSERT INTO users(id,email,password_hash) VALUES('user','owner@example.com','unused'); INSERT INTO workspaces(id,name,owner_id) VALUES('w','Store','user'),('other','Other','user')");const env={DB,TOKEN_ENCRYPTION_KEY:'11'.repeat(32)};await ensureCommerceSchema(env);await DB.prepare('INSERT INTO commerce_stores(id,workspace_id,provider,remote_id,name,origin,encrypted_credentials,capabilities,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind('store','w','shopify','gid://shopify/Shop/1','Example','https://example.myshopify.com',await encryptToken(JSON.stringify({access_token:'secret-token',webhook_secret:'hook-secret'}),env.TOKEN_ENCRYPTION_KEY),JSON.stringify({products:true,orders:true,tracking:true}),Date.now(),Date.now()).run();return env;}
const ctx={workspace:'w',store:'store',account:'account',recipient:'customer',session:'session',step:1};
test('store URLs and DNS addresses block private hosts and credential injection',()=>{
 for(const url of ['http://store.com','https://user:pass@store.com','https://127.0.0.1','https://store.local','https://store.com/path','https://store.com:8443','https://store.com?token=x'])assert.throws(()=>storeOrigin(url));
 for(const ip of ['127.0.0.1','10.0.1.1','169.254.169.254','172.16.1.1','192.168.1.1','100.64.0.1','::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(storeOrigin('https://shop.example.com/'),'https://shop.example.com');
 assert.throws(()=>validateCredentials('shopify',{url:'https://other.com',access_token:'x'}));
});
test('Shopify client credentials refresh and GraphQL uses pinned version',async()=>{
 const calls=[];const env={COMMERCE_FETCH:async(url,opts)=>{calls.push({url,opts});return Response.json(url.endsWith('/access_token')?{access_token:'fresh',expires_in:86399}:{data:{shop:{id:'shop1',name:'Shop'},currentAppInstallation:{accessScopes:[{handle:'read_orders'}]}}});}};
 const c=validateCredentials('shopify',{url:'https://example.myshopify.com',client_id:'client',client_secret:'secret'});
 assert.equal((await probeStore(env,'shopify',c)).capabilities.orders,true);assert.equal(c.access_token,'fresh');assert.match(calls[0].opts.body,/grant_type=client_credentials/);assert.match(calls[1].url,/2026-10\/graphql.json/);assert.equal(calls[1].opts.headers['X-Shopify-Access-Token'],'fresh');await probeStore(env,'shopify',c);assert.equal(calls.length,3);
});
test('orders require an exact verified email and never return billing addresses',async()=>{
 const env={COMMERCE_FETCH:async()=>Response.json({id:42,number:'42',status:'completed',billing:{email:'owner@example.com',address_1:'private'},meta_data:[]})};
 const c={origin:'https://shop.example.com',consumer_key:'key',consumer_secret:'secret'};
 assert.deepEqual(await queryStore(env,'woocommerce',c,'order',{reference:'42',email:'attacker@example.com'}),{order:null});
 const result=await queryStore(env,'woocommerce',c,'order',{reference:'42',email:'owner@example.com'});assert.equal(result.order.reference,'42');assert.doesNotMatch(JSON.stringify(result),/private|billing|owner@/);
 await assert.rejects(queryStore(env,'woocommerce',c,'order',{reference:'42'}),/identity_required/);
});
test('Nuvemshop uses current bearer API, aggregates and fulfillment tracking',async()=>{
 const env={COMMERCE_FETCH:async(url,opts)=>{assert.match(url,/2025-03\/123\/orders\?/);assert.match(url,/aggregates=fulfillment_orders/);assert.equal(opts.headers.Authorization,'Bearer token');assert.ok(opts.headers['User-Agent']);return Response.json([{number:12,contact_email:'a@example.com',payment_status:'paid',fulfillments:[{tracking_info:{code:'BR123',url:'https://tracking.example.com/BR123'}}]}]);}};
 const result=await queryStore(env,'nuvemshop',{store_id:'123',access_token:'token'},'tracking',{reference:'12',email:'a@example.com'});assert.equal(result.order.tracking[0].number,'BR123');
});
test('abandoned Shopify checkouts filter recovered and other-customer records locally',async()=>{
 const env={COMMERCE_FETCH:async(url,opts)=>{const q=JSON.parse(opts.body).query;assert.match(q,/customer\{email\}/);assert.doesNotMatch(q,/nodes\{id email/);return Response.json({data:{abandonedCheckouts:{nodes:[{id:'ok',customer:{email:'a@example.com'},abandonedCheckoutUrl:'https://store.example.com/cart'},{id:'other',customer:{email:'b@example.com'}},{id:'done',customer:{email:'a@example.com'},completedAt:'today'}],pageInfo:{hasNextPage:false}}}});}};
 const result=await queryStore(env,'shopify',{origin:'https://example.myshopify.com',access_token:'x'},'abandoned_carts',{email:'a@example.com'});assert.deepEqual(result.carts.map(c=>c.id),['ok']);
});
test('WordPress publishes content and explicitly rejects commerce without WooCommerce',async()=>{
 const env={COMMERCE_FETCH:async()=>Response.json([{id:1,title:{rendered:'<b>News</b>'},link:'https://blog.example.com/news'}])};const c={origin:'https://blog.example.com',username:'user',application_password:'secret'};
 assert.equal((await queryStore(env,'wordpress',c,'content')).products[0].name,'News');await assert.rejects(queryStore(env,'wordpress',c,'products'),/requires_woocommerce/);
});
test('workspace isolation, encrypted credentials and disconnect',async t=>{
 const env=await setup(t);await assert.rejects(ownedStore(env,'other','store'),/not_found/);
 env.COMMERCE_FETCH=async()=>Response.json({data:{shop:{id:'gid://shopify/Shop/1',name:'Store'},currentAppInstallation:{accessScopes:[{handle:'read_products'}]}}});
 const store=await connectStore(env,'w','shopify',{url:'https://example.myshopify.com',access_token:'sensitive'});assert.doesNotMatch(JSON.stringify(store),/sensitive|encrypted_credentials/);
 await assert.rejects(connectStore(env,'other','shopify',{url:'https://example.myshopify.com',access_token:'sensitive'}),/already_connected/);
 await disconnectStore(env,'w',store.id);assert.equal((await env.DB.prepare('SELECT encrypted_credentials FROM commerce_stores WHERE id=?').bind(store.id).first()).encrypted_credentials,'');await assert.rejects(readStore(env,'w',store.id,'products',{}),/disconnected/);
});
test('OTP is recipient-scoped, bounded and durable; changing email resets consent',async t=>{
 const env=await setup(t);const codes=[];env.COMMERCE_SEND_CODE=async c=>codes.push(c);
 const challenge=await issueChallenge(env,ctx,'a@example.com');await assert.rejects(confirmChallenge(env,{...ctx,challenge,recipient:'intruder'},codes[0].code),/invalid_verification/);
 assert.equal(await confirmChallenge(env,{...ctx,challenge},codes[0].code),'a@example.com');assert.equal(await confirmChallenge(env,{...ctx,challenge},codes[0].code),'a@example.com');
 await env.DB.prepare('UPDATE commerce_identities SET marketing_opt_in=1').run();const second=await issueChallenge(env,{...ctx,step:2},'b@example.com');await confirmChallenge(env,{...ctx,challenge:second},codes[1].code);assert.equal((await env.DB.prepare('SELECT marketing_opt_in FROM commerce_identities').first()).marketing_opt_in,0);
 assert.equal(await verifiedEmail(env,'store','account','customer'),'b@example.com');await assert.rejects(verifiedEmail(env,'store','different','customer'),/verification_required/);
 const third=await issueChallenge(env,{...ctx,step:3},'b@example.com');for(let i=0;i<5;i++)await assert.rejects(confirmChallenge(env,{...ctx,challenge:third},'000000'),/invalid_verification/);await assert.rejects(confirmChallenge(env,{...ctx,challenge:third},codes[2].code),/invalid_verification/);
});
test('marketing requires explicit phrase and opt-out immediately suppresses consent',async t=>{
 const env=await setup(t);let code;env.COMMERCE_SEND_CODE=async c=>code=c.code;const challenge=await issueChallenge(env,ctx,'a@example.com');await confirmChallenge(env,{...ctx,challenge},code);
 const row={workspace_id:'w',account_id:'account',id:'session',step_index:1},state={origin:{sender_id:'customer'},replyText:'SIM'},node={store_id:'store',operation:'marketing_opt_in'};
 await commerceNode(env,row,state,node);assert.equal((await env.DB.prepare('SELECT marketing_opt_in FROM commerce_identities').first()).marketing_opt_in,0);
 state.replyText='AUTORIZO NOVIDADES E LEMBRETES';await commerceNode(env,row,state,node);assert.equal((await env.DB.prepare('SELECT marketing_opt_in FROM commerce_identities').first()).marketing_opt_in,1);
 await observeCommerceInbound(env,{id:'account'},{kind:'dm',sender_id:'customer',text:'SAIR',at:Date.now()});const identity=await env.DB.prepare('SELECT * FROM commerce_identities').first();assert.equal(identity.marketing_opt_in,0);assert.equal(identity.opted_out,1);
});
test('signed webhooks reject forged bodies, bind shop and deduplicate delivery',async t=>{
 const env=await setup(t),raw=JSON.stringify({id:42,email:'customer@example.com'});const signature=createHmac('sha256','hook-secret').update(raw).digest('base64');
 const req=(body=raw,extra={})=>new Request('https://flownex.online/webhooks/commerce/store',{method:'POST',headers:{'x-shopify-topic':'orders/updated','x-shopify-event-id':'event1','x-shopify-shop-domain':'example.myshopify.com','x-shopify-hmac-sha256':signature,...extra},body});
 assert.equal((await commerceWebhook(req(raw+' '),env,'store')).status,401);assert.equal((await commerceWebhook(req(raw,{'x-shopify-shop-domain':'other.myshopify.com'}),env,'store')).status,403);
 assert.equal((await commerceWebhook(req(),env,'store')).status,200);assert.equal((await commerceWebhook(req(),env,'store')).status,200);const events=await env.DB.prepare('SELECT * FROM commerce_events').all();assert.equal(events.results.length,1);assert.doesNotMatch(events.results[0].encrypted_payload,/customer@example.com/);
});

test('product fanout includes only consented recent contacts and deduplicates repeat events',async t=>{
 const {processCommerce}=await import('../src/commerce/events.js');const env=await setup(t);
 await env.DB.prepare('INSERT INTO commerce_rules(id,store_id,workspace_id,account_id,event_type,enabled,message,created_at) VALUES(?,?,?,?,?,?,?,?)').bind('rule','store','w','account','product.created',1,'Novo: {product}',Date.now()).run();
 for(const [id,consent,optout,age]of [['eligible',1,0,0],['no-consent',0,0,0],['optout',1,1,0],['expired',1,0,86400001]])await env.DB.prepare('INSERT INTO commerce_identities(store_id,account_id,recipient_hash,encrypted_identity,email_hash,verified_until,marketing_opt_in,opted_out,last_incoming_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('store','account',await sha(id),await encryptToken(JSON.stringify({email:id+'@example.com',recipient:id}),env.TOKEN_ENCRYPTION_KEY),await sha(id+'@example.com'),Date.now()+3600000,consent,optout,Date.now()-age).run();
 for(const id of ['event1','event2'])await env.DB.prepare('INSERT INTO commerce_events(id,store_id,topic,encrypted_payload,due_at,received_at) VALUES(?,?,?,?,?,?)').bind(id,'store','products/create',await encryptToken(JSON.stringify({id:'product1',title:'New shirt',status:'active'}),env.TOKEN_ENCRYPTION_KEY),Date.now(),Date.now()).run();
 await processCommerce(env);const jobs=await env.DB.prepare('SELECT * FROM commerce_deliveries').all();assert.equal(jobs.results.length,1);assert.equal(jobs.results[0].recipient_hash,await sha('eligible'));
 // Revoking consent after enqueue must also block the eventual delivery.
 await env.DB.prepare('UPDATE commerce_identities SET opted_out=1').run();Object.assign(env,{MESSAGING_ENABLED:'true',META_APP_ID:'test',META_APP_SECRET:'test',META_WEBHOOK_SECRET:'test'});await processCommerce(env);assert.equal((await env.DB.prepare('SELECT status FROM commerce_deliveries').first()).status,'skipped');
});

test('partially registered hooks are reconciled without duplicate remote subscriptions',async()=>{
 const {registerWebhooks}=await import('../src/commerce/providers.js');const c={origin:'https://store.example.com',consumer_key:'key',consumer_secret:'secret',webhook_secret:'hook'},remote=[];let failOnce=true;
 const env={COMMERCE_FETCH:async(url,opts)=>{if(opts.method==='GET')return Response.json(remote);const data=JSON.parse(opts.body);if(data.topic==='order.updated'&&failOnce){failOnce=false;return new Response('',{status:500});}const hook={id:remote.length+1,...data};remote.push(hook);return Response.json(hook);}};
 await assert.rejects(registerWebhooks(env,'woocommerce',c,'https://flownex.online/hook'));
 assert.equal(remote.length,1);await registerWebhooks(env,'woocommerce',c,'https://flownex.online/hook');assert.equal(remote.length,3);await registerWebhooks(env,'woocommerce',c,'https://flownex.online/hook');assert.equal(remote.length,3);
});

test('commerce API rejects unauthenticated, cross-origin, foreign-workspace and viewer writes',async t=>{
 const {commerceApi}=await import('../src/commerce/api.js');const {sessionFor}=await import('../src/identity.js');const env=await setup(t);
 env.DB.sqlite.exec("UPDATE users SET email_verified_at=1; INSERT INTO memberships VALUES('w','user','viewer')");const cookie='fn_session='+await sessionFor('user',env);
 const req=(path,body,headers={})=>new Request('https://flownex.online'+path,{method:body?'POST':'GET',headers:{cookie,origin:'https://flownex.online','content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
 assert.equal((await commerceApi(req('/api/commerce/stores?workspace=w',null,{cookie:''}),env)).status,401);
 assert.equal((await commerceApi(req('/api/commerce/stores?workspace=other'),env)).status,403);
 assert.equal((await commerceApi(req('/api/commerce/stores/store/query',{workspace_id:'w',operation:'products'}),env)).status,403);
 env.DB.sqlite.exec("UPDATE memberships SET role='owner'");
 assert.equal((await commerceApi(req('/api/commerce/stores/store/query',{workspace_id:'w',operation:'products'},{origin:'https://attacker.example'}),env)).status,403);
 const list=await commerceApi(req('/api/commerce/stores?workspace=w'),env);assert.equal(list.status,200);assert.doesNotMatch(await list.text(),/secret-token|hook-secret|encrypted_credentials/);
});

test('Nuvemshop webhook uses hex HMAC and binds the store id',async t=>{
 const env=await setup(t);await env.DB.prepare("UPDATE commerce_stores SET provider='nuvemshop',remote_id='123'").run();
 const request=data=>{const body=JSON.stringify(data);return new Request('https://flownex.online/webhooks/commerce/store',{method:'POST',body,headers:{'x-linkedstore-hmac-sha256':createHmac('sha256','hook-secret').update(body).digest('hex')}});};
 assert.equal((await commerceWebhook(request({store_id:456,event:'order/updated',id:1}),env,'store')).status,403);
 assert.equal((await commerceWebhook(request({store_id:123,event:'order/updated',id:1}),env,'store')).status,200);
 assert.equal((await commerceWebhook(request({store_id:123,event:'order/updated',id:1}),env,'store')).status,200);
 assert.equal((await env.DB.prepare('SELECT count(*) n FROM commerce_events').first()).n,2,'ID-only order updates must not be collapsed forever');
});

test('fanout checkpoint resumes a second page without duplicate recipients',async t=>{
 const {processCommerce}=await import('../src/commerce/events.js');const env=await setup(t);
 await env.DB.prepare('INSERT INTO commerce_rules(id,store_id,workspace_id,account_id,event_type,enabled,message,created_at) VALUES(?,?,?,?,?,?,?,?)').bind('rule','store','w','account','product.created',1,'Novo {product}',Date.now()).run();
 for(let i=0;i<55;i++)await env.DB.prepare('INSERT INTO commerce_identities(store_id,account_id,recipient_hash,encrypted_identity,email_hash,verified_until,marketing_opt_in,last_incoming_at) VALUES(?,?,?,?,?,?,?,?)').bind('store','account',String(i).padStart(3,'0'),await encryptToken(JSON.stringify({email:'a@example.com',recipient:String(i)}),env.TOKEN_ENCRYPTION_KEY),'hash',Date.now()+10000,1,Date.now()).run();
 await env.DB.prepare('INSERT INTO commerce_events(id,store_id,topic,encrypted_payload,due_at,received_at) VALUES(?,?,?,?,?,?)').bind('event','store','products/create',await encryptToken(JSON.stringify({id:1,title:'Product',status:'active'}),env.TOKEN_ENCRYPTION_KEY),Date.now(),Date.now()).run();
 await processCommerce(env,1);assert.equal((await env.DB.prepare('SELECT count(*) n FROM commerce_deliveries').first()).n,50);assert.equal((await env.DB.prepare('SELECT status FROM commerce_events').first()).status,'pending');
 env.DB.sqlite.exec('UPDATE commerce_events SET due_at=0');await processCommerce(env,1);assert.equal((await env.DB.prepare('SELECT count(*) n FROM commerce_deliveries').first()).n,55);assert.equal((await env.DB.prepare('SELECT status FROM commerce_events').first()).status,'processed');
});

test('billing usage includes reserved, accepted and uncertain commerce deliveries',async t=>{
 const {messageUsage}=await import('../src/billing.js'),{readFileSync}=await import('node:fs');const env=await setup(t);env.DB.sqlite.exec(readFileSync(new URL('../migrations/0005_runtime.sql',import.meta.url),'utf8'));
 await env.DB.prepare('INSERT INTO commerce_rules(id,store_id,workspace_id,account_id,event_type,message,created_at) VALUES(?,?,?,?,?,?,?)').bind('rule','store','w','account','product.created','New',Date.now()).run();
 for(const status of ['sending','accepted','unknown','failed','pending','skipped'])await env.DB.prepare('INSERT INTO commerce_deliveries(id,event_id,rule_id,store_id,account_id,recipient_hash,encrypted_action,status,attempt_at,due_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(status,'event','rule','store','account','hash','encrypted',status,Date.now(),Date.now()).run();
 assert.equal((await messageUsage(env,'w')).used,3);assert.equal((await messageUsage(env,'other')).used,0);
});
