// Run explicitly with PLAYWRIGHT_MODULE pointing to an existing Playwright install.
// No live credentials, external network requests, emails or Instagram sends occur.
import {createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import runtime from '../src/index.js';
import {identityDatabase} from '../tests/identity-helper.js';
const require=createRequire(import.meta.url);
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE to a locally installed playwright or @playwright/test module.');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const db=identityDatabase();
db.sqlite.exec(readFileSync(new URL('../migrations/0005_runtime.sql',import.meta.url),'utf8'));
const sent=[],metaCalls=[],browserErrors=[],checks=[],apiErrors=[],browserRoutes=[];
checks.push=function(...items){console.log('CHECK',items[0]);return Array.prototype.push.apply(this,items);};
const env={DB:db,RESEND_API_KEY:'fake-browser-key',PUBLIC_BASE_URL:'https://flownex.online',APP_MODE:'production',PUBLIC_SIGNUP_ENABLED:'true',SESSION_SECRET:'fake-session-secret-for-browser',CRON_SECRET:'fake-browser-cron-secret-123456',MESSAGING_ENABLED:'true',TOKEN_ENCRYPTION_KEY:'a'.repeat(64),META_APP_ID:'123',META_APP_SECRET:'fake-meta-secret',META_REDIRECT_URI:'https://flownex.online/api/instagram/callback',META_VERIFY_TOKEN:'fake-verify'};
env.RESEND_FETCH=async(url,options)=>{assert.equal(String(url),'https://api.resend.com/emails');sent.push(JSON.parse(options.body));return Response.json({id:'fake-browser-mail-'+sent.length});};
env.META_FETCH=async(input,options={})=>{
 const url=new URL(input);metaCalls.push({path:url.pathname,method:options.method||'GET'});
 if(url.hostname==='api.instagram.com'&&url.pathname==='/oauth/access_token')return Response.json({access_token:'fake-short-token',user_id:12345});
 if(url.hostname==='graph.instagram.com'&&url.pathname==='/access_token')return Response.json({access_token:'fake-long-token',token_type:'bearer',expires_in:5184000});
 if(url.hostname==='graph.instagram.com'&&url.pathname==='/me')return Response.json({user_id:'12345',username:'browser_test_brand',account_type:'BUSINESS'});
 if(url.hostname==='graph.instagram.com'&&url.pathname==='/v24.0/12345/subscribed_apps')return Response.json(options.method==='POST'?{success:true}:{data:[{id:'123',subscribed_fields:['comments','messages']}]});
 if(url.hostname==='graph.instagram.com'&&url.pathname==='/v24.0/999/replies')return Response.json({id:'provider-accepted-reference'});
 if(url.hostname==='graph.instagram.com'&&url.pathname==='/v24.0/999')return Response.json({id:'999',timestamp:new Date().toISOString()});
 if(url.hostname==='graph.instagram.com'&&url.pathname==='/v24.0/12345/messages')return Response.json({}); // Deliberately uncertain provider result.
 if(url.hostname==='graph.instagram.com'&&url.pathname==='/v24.0/12345/media')return Response.json({data:[{id:'555',caption:'Published test post'}]});
 throw Error('Unexpected external provider boundary path: '+url.pathname);
};
let browser;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>browserErrors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());browserRoutes.push({host:url.hostname,path:url.pathname});
  if(url.hostname==='www.instagram.com'&&url.pathname==='/oauth/authorize'){
   // The only browser-side provider stub: approval returns the genuine issued state.
   const callback=new URL(env.META_REDIRECT_URI);callback.searchParams.set('state',url.searchParams.get('state'));callback.searchParams.set('code','fake-approved-code');
   await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Mock Meta approval</title><script>location.replace('+JSON.stringify(callback.href)+')</script>'});return;
  }
  if(url.origin!=='https://flownex.online')throw Error('Unexpected browser network destination');
  const headers=await req.allHeaders();const body=req.postDataBuffer();
  const request=new Request(req.url(),{method:req.method(),headers,...(body?{body}:{} )});
  const response=await runtime.fetch(request,env);if(response.status===302){await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><script>location.replace('+JSON.stringify(response.headers.get('location'))+')</script>'});return;}if(!response.ok&&response.status!==302){const detail=await response.clone().json().catch(()=>({}));apiErrors.push({path:url.pathname,status:response.status,error:detail.error});}await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers.entries()),body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto('https://flownex.online/app');
 await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByLabel('E-mail',{exact:true}).fill('browser-owner@example.test');await page.getByLabel('Senha',{exact:true}).fill('Browser-password-12345');await page.getByLabel('Nome do seu espaço').fill('Browser test workspace');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByText('Cadastro recebido.',{exact:false}).waitFor();assert.equal(sent.length,1);assert.equal(db.sqlite.prepare('SELECT email_verified_at FROM users').get().email_verified_at,null);assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);checks.push('Registration persists unverified user and sends full verification email through mocked Resend only');
 const verifyURL=sent[0].text.match(/https:\/\/flownex\.online\/app#verify=\S+/)[0];
 await page.goto(verifyURL);await page.getByRole('button',{name:'Confirmar e entrar',exact:true}).waitFor();assert.equal(db.sqlite.prepare('SELECT email_verified_at FROM users').get().email_verified_at,null);checks.push('Opening verification link does not consume token');
 await page.getByRole('button',{name:'Confirmar e entrar',exact:true}).click();await page.getByRole('heading',{name:'Suas automações'}).waitFor();assert.ok(db.sqlite.prepare('SELECT email_verified_at FROM users').get().email_verified_at);assert.equal(await page.locator('#workspace-select option').count(),1);checks.push('Explicit verification creates genuine secure session and loads actual workspace');
 await page.getByRole('button',{name:'Conectar Instagram',exact:true}).click();await page.waitForURL('https://flownex.online/app?connected=1',{timeout:10000});await page.getByText('@browser_test_brand',{exact:true}).waitFor();const account=db.sqlite.prepare('SELECT * FROM instagram_accounts').get();assert.equal(account.status,'connected');assert.ok(account.encrypted_token.startsWith('v1.'));assert.ok(!account.encrypted_token.includes('fake-long-token'));assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM oauth_states').get().n,0);checks.push('Real OAuth state, token exchange, verified webhook subscription and encrypted account persistence');
 await page.getByRole('button',{name:'Novo fluxo',exact:true}).click();await page.getByLabel('Nome do fluxo').fill('Real runtime browser flow');await page.getByLabel('Publicações',{exact:true}).selectOption('selected');await page.getByRole('button',{name:'Carregar publicações',exact:true}).click();await page.getByLabel('Published test post',{exact:true}).check();await page.getByLabel('Texto da mensagem',{exact:true}).fill('This is the requested link.');await page.getByRole('button',{name:'Adicionar mensagem',exact:true}).click();await page.getByLabel('Texto da mensagem',{exact:true}).nth(1).fill('Sent you the link in Direct.');await page.getByRole('button',{name:'↑ Subir',exact:true}).nth(1).click();await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await page.getByText('Rascunho salvo.',{exact:false}).waitFor();
 let flow=db.sqlite.prepare('SELECT * FROM flows').get();assert.equal(flow.enabled,0);assert.deepEqual(JSON.parse(flow.configuration).media_ids,['555']);assert.equal(JSON.parse(flow.configuration).actions[0].type,'public_reply');checks.push('Visual editor saves actual SQLite draft with selected media and reordered valid actions');
 await page.getByLabel('ID da publicação de teste (opcional)',{exact:true}).fill('555');await page.getByRole('button',{name:'Salvar e simular',exact:true}).click();await page.getByText('O evento corresponde ao fluxo.',{exact:false}).waitFor();assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM automation_jobs').get().n,0);checks.push('Real runtime simulation matches saved configuration without scheduling delivery');
 await page.getByRole('button',{name:'Salvar e publicar',exact:true}).click();await page.getByText('Fluxo publicado.',{exact:false}).waitFor();assert.equal(db.sqlite.prepare('SELECT enabled FROM flows').get().enabled,1);checks.push('Publish validates provider configuration and enables persisted flow');

 const webhookBody=JSON.stringify({object:'instagram',entry:[{id:'12345',time:Math.floor(Date.now()/1000),changes:[{field:'comments',value:{id:'999',from:{id:'678'},media:{id:'555'},text:'QUERO',created_time:Math.floor(Date.now()/1000)}}]}]});
 const signature='sha256='+createHmac('sha256',env.META_APP_SECRET).update(webhookBody).digest('hex');
 const queued=await runtime.fetch(new Request('https://flownex.online/webhooks/instagram',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':signature},body:webhookBody}),env);assert.equal(queued.status,200);
 const tickRequest=()=>new Request('https://flownex.online/api/internal/tick',{method:'POST',headers:{authorization:'Bearer '+env.CRON_SECRET}});
 assert.equal((await runtime.fetch(tickRequest(),env)).status,200);
 const jobs=db.sqlite.prepare('SELECT status,provider_id FROM automation_jobs ORDER BY action_index').all();assert.deepEqual(jobs.map(j=>j.status),['accepted','unknown']);assert.equal(jobs[0].provider_id,'provider-accepted-reference');
 const sendCount=()=>metaCalls.filter(c=>c.path.endsWith('/messages')||c.path.endsWith('/replies')).length;const firstSendCount=sendCount();assert.equal(firstSendCount,2);await runtime.fetch(tickRequest(),env);assert.equal(sendCount(),firstSendCount);
 await page.getByRole('button',{name:'Atualizar',exact:true}).click();await page.getByText('Aceito pela Meta',{exact:true}).waitFor();await page.getByText('Entrega a confirmar',{exact:true}).waitFor();await page.getByText('provider-accepted-reference',{exact:true}).waitFor();await page.getByText('Resultado sem confirmação. Não será reenviado automaticamente.',{exact:true}).waitFor();checks.push('Signed webhook and actual queue persist accepted/unknown provider results, display truthful history and never retry unknown');
 await page.getByRole('button',{name:'Pausar fluxo',exact:true}).click();await page.getByText('Fluxo pausado.',{exact:true}).waitFor();assert.equal(db.sqlite.prepare('SELECT enabled FROM flows').get().enabled,0);checks.push('Pause disables persisted flow');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'/tmp/flownexa-browser-runtime-mobile.png',fullPage:true});checks.push('Real app renders at 390px without horizontal overflow');
 await page.getByRole('button',{name:'Sair',exact:true}).click();await page.getByRole('heading',{name:'Entre na sua conta',exact:true}).waitFor();assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);checks.push('Logout revokes server session');
 await page.getByRole('button',{name:'Esqueci a senha',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).fill('browser-owner@example.test');await page.getByRole('button',{name:'Enviar link de recuperação',exact:true}).click();await page.getByText('Se o endereço estiver cadastrado',{exact:false}).waitFor();assert.equal(sent.length,2);const resetURL=sent[1].text.match(/https:\/\/flownex\.online\/app#reset=\S+/)[0];await page.goto(resetURL);await page.getByLabel('Nova senha',{exact:true}).fill('Updated-browser-password-6789');await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();await page.getByText('Senha atualizada.',{exact:false}).waitFor();await page.getByLabel('E-mail',{exact:true}).fill('browser-owner@example.test');await page.getByLabel('Senha',{exact:true}).fill('Updated-browser-password-6789');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('heading',{name:'Suas automações',exact:true}).waitFor();checks.push('Password recovery and reset persist new password and allow genuine login');
 assert.deepEqual(browserErrors,[]);assert.equal(metaCalls.filter(c=>c.path.endsWith('/messages')||c.path.endsWith('/replies')).length,2);
 const report={passed:true,checked_at:new Date().toISOString(),checks,external_network_requests:0,actual_emails_sent:0,actual_instagram_messages_sent:0,mocked_transactional_emails:sent.length,provider_boundary_calls:metaCalls,browser_errors:browserErrors};writeFileSync('/tmp/flownexa-browser-runtime-report.json',JSON.stringify(report,null,2));console.log('BROWSER_RUNTIME_OK',JSON.stringify({checks:checks.length,mockedEmails:sent.length,actualEmails:0,actualInstagramMessages:0}));
}catch(error){writeFileSync('/tmp/flownexa-browser-runtime-report.json',JSON.stringify({passed:false,checks,error:error.message,browser_errors:browserErrors,api_errors:apiErrors,browser_routes:browserRoutes,provider_boundary_calls:metaCalls},null,2));throw error;}finally{await browser?.close();db.close();}
