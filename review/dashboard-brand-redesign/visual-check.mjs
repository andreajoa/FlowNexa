// Offline browser verification: all HTTP responses are intercepted, no real API calls.
// Usage: PUPPETEER_PATH=/absolute/path/to/puppeteer-core/lib/puppeteer/puppeteer-core.js node review/dashboard-brand-redesign/visual-check.mjs
import {appPage} from '../../src/app-ui.js';
import {appClient} from '../../src/app-client.js';
import {commercialPlans} from '../../src/commercial-plans.js';
import {landingClient} from '../../src/landing-script.js';
import {landingPage} from '../../src/landing.js';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const {default:puppeteer}=await import(process.env.PUPPETEER_PATH);
const out=new URL('./',import.meta.url);
const baseline=execFileSync('git',['show','HEAD:src/app-ui.js'],{encoding:'utf8'});
const before=(await import('data:text/javascript;base64,'+Buffer.from(baseline).toString('base64'))).appPage();
assert.equal(appPage().replace(/<style>[\s\S]*?<\/style>/,''),before.replace(/<style>[\s\S]*?<\/style>/,''),'HTML and hooks unchanged');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox'],userDataDir:'/private/tmp/flownexa-redesign-chrome'});
const page=await browser.newPage();
let signedIn=true,empty=false,old=false;const errors=[],writes=[],results=[];
const flow={id:'demo-flow',name:'Conversa de boas-vindas',account_id:'demo-account',enabled:false,trigger_type:'dm_keyword',scope:'all',configuration:{keywords:['oi'],actions:[{type:'message',text:'Olá! Como podemos ajudar?'}]}};
page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message)});
await page.setRequestInterception(true);
page.on('request',async request=>{
  const url=new URL(request.url());let body='',contentType='text/html',status=200;
  if(request.method()!=='GET')writes.push(request.method()+' '+url.pathname);
  if(url.pathname==='/app')body=old?before:appPage();
  else if(url.pathname==='/')body=landingPage();
  else if(url.pathname==='/landing.js'){body=landingClient();contentType='text/javascript';}
  else if(url.pathname==='/app.js'){body=appClient();contentType='text/javascript';}
  else if(url.pathname.startsWith('/assets/')){try{body=await readFile(new URL('../../public'+url.pathname,import.meta.url));contentType=url.pathname.endsWith('.svg')?'image/svg+xml':url.pathname.endsWith('.png')?'image/png':'image/jpeg';}catch{status=404;}}
  else if(url.pathname.startsWith('/api/')){
    contentType='application/json';let data={};
    if(url.pathname==='/api/auth/me'){if(!signedIn){status=401;data={error:'unauthorized'};}else data={user:{email:'revisao@example.test'}};}
    else if(url.pathname==='/api/workspaces')data={workspaces:[{id:'demo',name:'Workspace de revisão'}]};
    else if(url.pathname==='/api/accounts')data={accounts:empty?[]:[{id:'demo-account',username:'flownexa_demo',status:'connected'}]};
    else if(url.pathname==='/api/flows')data={flows:empty?[]:[flow]};
    else if(url.pathname==='/api/flows/demo-flow')data={flow};
    else if(url.pathname==='/api/executions')data={executions:empty?[]:[{flow_name:flow.name,status:'completed',provider_id:'referencia-demo-1234567890',created_at:1792490000}]};
    else if(url.pathname==='/api/billing/status')data={configured:true,can_manage:true,plans:commercialPlans()};
    else if(url.pathname==='/api/agent-tokens')data={tokens:[]};
    body=JSON.stringify(data);
  }
  await request.respond({status,contentType,body});
});
async function load(){await page.goto('http://flownexa.test/app',{waitUntil:'networkidle0'});await page.waitForSelector(signedIn?'#workspace:not([hidden])':'#auth form');}
try{
  for(const width of [320,375,768,1024,1440]){
    await page.setViewport({width,height:960,deviceScaleFactor:1});await load();
    assert.equal(await page.$eval('#new-conversation',e=>getComputedStyle(e).backgroundColor),'rgb(249, 212, 59)');
    assert.equal(await page.$eval('.billing-period [aria-pressed="true"]',e=>getComputedStyle(e).backgroundColor),'rgb(23, 20, 31)');
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflows:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().right>innerWidth+1&&!e.closest('.table-wrap')).map(e=>e.id||e.className)}));
    assert.ok(layout.scroll<=width,JSON.stringify(layout));results.push({view:'dashboard',...layout});
    await page.screenshot({path:new URL('dashboard-'+width+'.png',out).pathname,fullPage:true});
    await page.click('#refresh-activity');
    await page.click('a[href="#conversation-models"]');
    assert.equal(await page.evaluate(()=>location.hash),'#conversation-models');
    await page.$eval('#new-conversation',e=>e.click());await page.waitForSelector('#graph-dialog[open]');
    assert.ok(await page.$('#graph-dialog input'),'Graph form remains available');
    await page.keyboard.press('Escape');
    assert.equal(await page.$('#graph-dialog[open]'),null);
    signedIn=false;await load();
    assert.equal(await page.$eval('html',e=>e.scrollWidth),width);
    await page.screenshot({path:new URL('auth-'+width+'.png',out).pathname,fullPage:true});
    await page.evaluate(()=>[...document.querySelectorAll('#auth button')].find(b=>b.textContent==='Criar conta').click());
    assert.equal(await page.$eval('#auth h1',e=>e.textContent),'Crie sua conta FlowNexa');
    signedIn=true;
  }
  await page.setViewport({width:1440,height:960,deviceScaleFactor:1});empty=true;await load();await page.screenshot({path:new URL('dashboard-empty.png',out).pathname,fullPage:true});
  empty=false;old=true;await load();await page.screenshot({path:new URL('dashboard-before.png',out).pathname,fullPage:true});
  await page.goto('http://flownexa.test/',{waitUntil:'networkidle0'});await page.screenshot({path:new URL('landing-reference.png',out).pathname});
  old=false;
  // The language on screen takes priority over browser language and stale currency storage.
  await page.evaluate(()=>localStorage.setItem('flownexa_billing_currency','usd'));
  await load();
  assert.equal(await page.$$eval('.billing-price',els=>els.every(e=>e.textContent.includes('R$'))),true);
  await page.evaluate(()=>document.documentElement.lang='en');
  await page.waitForFunction(()=>[...document.querySelectorAll('.billing-price')].length===2&&[...document.querySelectorAll('.billing-price')].every(e=>e.textContent.includes('$')&&!e.textContent.includes('R$')));
  await page.click('[data-period="year"]');
  await page.waitForFunction(()=>document.querySelector('.billing-price').textContent==='$129.00');
  await page.evaluate(()=>document.documentElement.lang='pt-BR');
  await page.waitForFunction(()=>[...document.querySelectorAll('.billing-price')].every(e=>e.textContent.includes('R$')));
  await page.goto('http://flownexa.test/',{waitUntil:'networkidle0'});
  assert.equal(await page.$$eval('.plan-price',els=>els.every(e=>e.textContent.includes('R$'))),true);
  await page.evaluate(()=>document.documentElement.lang='en');
  await page.waitForFunction(()=>[...document.querySelectorAll('.plan-price')].every(e=>e.textContent.includes('$')&&!e.textContent.includes('R$')));
  assert.equal(await page.$eval('.plan-action',e=>new URL(e.href).searchParams.get('lang')),'en');
  await page.click('[data-billing="yearly"]');
  assert.equal(await page.$eval('.plan-price',e=>e.textContent),'$129.00/year');
  await page.evaluate(()=>document.documentElement.lang='pt-BR');
  await page.waitForFunction(()=>document.querySelector('.plan-price').textContent.includes('599,00'));
  assert.equal(await page.$('#pricing-currency'),null);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await writeFile(new URL('visual-results.json',out),JSON.stringify({htmlUnchanged:true,results,errors,writes,checks:['auth registration navigation','activity refresh','sidebar anchor','graph dialog open/close','empty dashboard'],network:'All requests intercepted; no external services contacted'},null,2));
  console.log('Visual verification passed at all five widths; HTML unchanged; no JS errors or write requests.');
}finally{await browser.close();}
