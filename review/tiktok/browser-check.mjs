// Real commerce API + SQLite; only external platforms and unrelated dashboard APIs are mocked.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {appPage} from '../../src/app-ui.js';
import {appClient} from '../../src/app-client.js';
import {identityDatabase} from '../../tests/identity-helper.js';
import {sessionFor} from '../../src/identity.js';
import {tiktokApi} from '../../src/tiktok/api.js';
import {ensureSchema} from '../../src/tiktok/schema.js';
import {acceptTikTokWebhook,processTikTokJobs} from '../../src/tiktok/runtime.js';
import {validateGraph} from '../../src/conversation-graph.js';
const {default:puppeteer}=await import(process.env.PUPPETEER_PATH);
const DB=identityDatabase();DB.sqlite.exec("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('user','owner@example.com','unused',1); INSERT INTO workspaces(id,name,owner_id) VALUES('workspace','Loja de teste','user'); INSERT INTO memberships VALUES('workspace','user','owner');");
const env={DB,TOKEN_ENCRYPTION_KEY:'11'.repeat(32),ZERNIO_API_KEY:'test',ZERNIO_WEBHOOK_SECRET:'test',TIKTOK_SENDS_ENABLED:'true',ZERNIO_FETCH:async()=>Response.json({success:true,data:{messageId:'accepted'}})};
await ensureSchema(env);
DB.sqlite.exec("INSERT INTO tiktok_accounts(id,workspace_id,remote_id,profile_id,native_id,name,created_at) VALUES('tiktok','workspace','aaaaaaaaaaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbbbbbbbbbb','native','Loja TikTok',1)");
const cookie='fn_session='+await sessionFor('user',env);
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
await page.setRequestInterception(true);
page.on('request',async r=>{try{
 const url=new URL(r.url());let body='',contentType='text/html',status=200;
 if(url.pathname==='/app')body=appPage();
 else if(url.pathname==='/app.js'){body=appClient();contentType='text/javascript';}
 else if(url.pathname.startsWith('/api/tiktok/')){
  const response=await tiktokApi(new Request(r.url(),{method:r.method(),headers:{cookie,origin:url.origin,'content-type':'application/json'},body:r.method()==='POST'?r.postData():undefined}),env);status=response.status;body=await response.text();if(status>=400)console.error(url.pathname,status,body);contentType='application/json';
 }else if(url.pathname.startsWith('/api/')){
  let data={};contentType='application/json';
  if(url.pathname==='/api/auth/me')data={user:{id:'user',email:'owner@example.com'}};
  if(url.pathname==='/api/workspaces')data={workspaces:[{id:'workspace',name:'Loja de teste',role:'owner'}]};
  if(url.pathname==='/api/accounts')data={accounts:[]};
  if(url.pathname==='/api/flows')data={flows:[]};
  if(url.pathname==='/api/billing/status')data={configured:false,can_manage:true,plans:[]};
  body=JSON.stringify(data);
 }else status=404;
 await r.respond({status,body,contentType});
 }catch(e){errors.push(e.message);await r.respond({status:500,body:'error'});}});
const clickText=async(selector,text)=>page.evaluate((selector,text)=>{const b=[...document.querySelectorAll(selector)].find(x=>x.textContent===text);if(!b)throw Error('Missing '+text);b.click();},selector,text);
try{
 await page.setViewport({width:1440,height:1000});await page.goto('https://flownexa.test/app#tiktok-channel',{waitUntil:'networkidle0'});await page.waitForSelector('#tiktok-channel:not([hidden]) form');
 await page.type('#tiktok-channel form input','Boas-vindas TikTok');await page.type('#tiktok-channel form textarea','Olá! Como posso ajudar?');await clickText('#tiktok-channel button','Salvar rascunho');
 await page.waitForFunction(()=>[...document.querySelectorAll('#tiktok-channel article strong')].some(x=>x.textContent==='Boas-vindas TikTok'));
 await clickText('#tiktok-channel button','Editar conversa');await page.waitForSelector('#graph-dialog[open]');
 assert.equal(await page.$$eval('.graph-palette button',els=>els.some(x=>/Imagem|Vídeo|Loja/.test(x.textContent))),false);
 await clickText('#graph-dialog button','Salvar e publicar conversa');await page.waitForFunction(()=>document.querySelector('#graph-dialog .status').textContent.includes('publicada no TikTok'));
 await page.keyboard.press('Escape');assert.equal(DB.sqlite.prepare('SELECT enabled FROM tiktok_flows').get().enabled,1);
 const event={event:'message.received',account:{platform:'tiktok',accountId:'aaaaaaaaaaaaaaaaaaaaaaaa',profileId:'bbbbbbbbbbbbbbbbbbbbbbbb'},message:{platform:'tiktok',direction:'incoming',sender:{id:'visitor'},platformMessageId:'message',conversationId:'conversation',text:'Oi',sentAt:new Date().toISOString()}};
 await acceptTikTokWebhook(event,env);await processTikTokJobs(env);assert.equal(DB.sqlite.prepare('SELECT status FROM tiktok_jobs').get().status,'accepted');
 await clickText('#tiktok-channel button','Atualizar TikTok');await page.waitForFunction(()=>document.querySelector('#tiktok-channel').textContent.includes('Aceita pelo provedor'));
 for(const width of [375,768,1440]){await page.setViewport({width,height:1000});const scroll=await page.$eval('html',e=>e.scrollWidth);assert.equal(scroll,width,'overflow '+width);await page.screenshot({path:new URL('tiktok-'+width+'.png',import.meta.url).pathname,fullPage:true});results.push({width,scroll});}
 await clickText('#tiktok-channel button','Pausar');await page.waitForFunction(()=>document.querySelector('#tiktok-channel article').textContent.includes('pausada'));assert.equal(DB.sqlite.prepare('SELECT enabled FROM tiktok_flows').get().enabled,0);
 assert.deepEqual(errors,[]);await writeFile(new URL('browser-results.json',import.meta.url),JSON.stringify({results,errors,checks:['TikTok tab opens directly','No Instagram account needed','Actual API and SQLite draft save','Visual editor restricted to supported blocks','Publish from visual editor','Inbound event → queue → mocked provider → activity','Pause automation'],externalCalls:0},null,2));console.log('TikTok browser checks passed');
}finally{await browser.close();DB.close();}
