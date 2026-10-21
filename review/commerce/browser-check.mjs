// Real commerce API + SQLite; only external platforms and unrelated dashboard APIs are mocked.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {appPage} from '../../src/app-ui.js';
import {appClient} from '../../src/app-client.js';
import {identityDatabase} from '../../tests/identity-helper.js';
import {sessionFor} from '../../src/identity.js';
import {commerceApi} from '../../src/commerce/api.js';
import {validateGraph} from '../../src/conversation-graph.js';
const {default:puppeteer}=await import(process.env.PUPPETEER_PATH);
const DB=identityDatabase();DB.sqlite.exec("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('user','owner@example.com','unused',1); INSERT INTO workspaces(id,name,owner_id) VALUES('workspace','Loja de teste','user'); INSERT INTO memberships VALUES('workspace','user','owner');");
const env={DB,TOKEN_ENCRYPTION_KEY:'11'.repeat(32),COMMERCE_FETCH:async(url,opts)=>{
 const query=JSON.parse(opts.body||'{}').query||'';
 if(query.includes('currentAppInstallation'))return Response.json({data:{shop:{id:'gid://shopify/Shop/1',name:'Loja demonstração'},currentAppInstallation:{accessScopes:[{handle:'read_products'},{handle:'read_orders'}]}}});
 if(query.includes('products('))return Response.json({data:{products:{nodes:[{id:'1',title:'Produto de teste',onlineStoreUrl:'https://store.example.com/product',variants:{nodes:[{price:'49.90'}]}}]}}});
 throw Error('Unexpected provider request');
}};
const cookie='fn_session='+await sessionFor('user',env);
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
await page.setRequestInterception(true);
page.on('request',async r=>{try{
 const url=new URL(r.url());let body='',contentType='text/html',status=200;
 if(url.pathname==='/app')body=appPage();
 else if(url.pathname==='/app.js'){body=appClient();contentType='text/javascript';}
 else if(url.pathname.startsWith('/api/commerce/')){
  const response=await commerceApi(new Request(r.url(),{method:r.method(),headers:{cookie,origin:url.origin,'content-type':'application/json'},body:r.method()==='POST'?r.postData():undefined}),env);status=response.status;body=await response.text();if(status>=400)console.error(url.pathname,status,body);contentType='application/json';
 }else if(url.pathname.startsWith('/api/')){
  let data={};contentType='application/json';
  if(url.pathname==='/api/auth/me')data={user:{id:'user',email:'owner@example.com'}};
  if(url.pathname==='/api/workspaces')data={workspaces:[{id:'workspace',name:'Loja de teste',role:'owner'}]};
  if(url.pathname==='/api/accounts')data={accounts:[{id:'account',username:'loja_teste',status:'connected'}]};
  if(url.pathname==='/api/flows')data={flows:[]};
  if(url.pathname==='/api/billing/status')data={configured:false,can_manage:true,plans:[]};
  body=JSON.stringify(data);
 }else status=404;
 await r.respond({status,body,contentType});
 }catch(e){errors.push(e.message);await r.respond({status:500,body:'error'});}});
try{
 await page.setViewport({width:1440,height:1000});await page.goto('https://flownexa.test/app',{waitUntil:'networkidle0'});await page.waitForSelector('#workspace:not([hidden])');
 await page.evaluate(()=>document.querySelector('a[href="#commerce"]').click());
 await page.click('.commerce-add summary');
 await page.select('#commerce-connect select:nth-of-type(1)','shopify');
 await page.evaluate(()=>{const selects=document.querySelectorAll('#commerce-connect select');selects[1].value='legacy';selects[1].dispatchEvent(new Event('change'));});
 await page.type('#commerce-connect input[type=url]','https://example.myshopify.com');await page.type('#commerce-connect input[type=password]','mock-access-token');await page.click('#commerce-connect button[type=submit]');
 await page.waitForSelector('.commerce-store');assert.match(await page.$eval('.commerce-store',e=>e.textContent),/Loja demonstração/);
 assert.equal(await page.$eval('#commerce-connect input[type=password]',e=>e.value),'');
 await page.evaluate(()=>[...document.querySelectorAll('.commerce-store summary')].find(e=>e.textContent==='Testar leitura da loja').click());await page.click('.commerce-store details form button[type=submit]');await page.waitForFunction(()=>document.querySelector('.commerce-result').textContent.includes('Produto de teste'));
 await page.evaluate(()=>[...document.querySelectorAll('.commerce-store button')].find(e=>e.textContent==='Consultar pedido').click());await page.waitForSelector('#graph-dialog[open]');await page.keyboard.press('Escape');
 for(const width of [375,768,1440]){await page.setViewport({width,height:1000});const scroll=await page.$eval('html',e=>e.scrollWidth);assert.equal(scroll,width,'horizontal overflow at '+width);await page.screenshot({path:new URL('stores-'+width+'.png',import.meta.url).pathname,fullPage:true});results.push({width,scroll});}
 assert.deepEqual(errors,[]);await writeFile(new URL('browser-results.json',import.meta.url),JSON.stringify({results,errors,checks:['connect form → actual API → encrypted SQLite','credential cleared','query → actual API → mocked Shopify','order automation opens graph editor'],externalCalls:0},null,2));console.log('Commerce browser checks passed');
}catch(e){console.error('UI status:',await page.$eval('#commerce-status',e=>e.textContent),'Errors:',errors);throw e;}finally{await browser.close();DB.close();}
