// Isolated browser test. All vendor requests are mocked; no live account or message is used.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import runtime from '../src/index.js';
import {identityDatabase} from '../tests/identity-helper.js';
import {sessionFor} from '../src/identity.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE),db=identityDatabase();
for(const file of ['0005_runtime.sql','0007_billing.sql','0008_conversations.sql'])db.sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
db.sqlite.exec("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('u','owner@example.test','unused',1);INSERT INTO workspaces(id,name,owner_id) VALUES('w','Workspace','u');INSERT INTO memberships VALUES('w','u','owner');");
const env={DB:db,APP_MODE:'production',TOKEN_ENCRYPTION_KEY:'a'.repeat(64),ZERNIO_API_KEY:'mock-server-only-provider-key',ZERNIO_WEBHOOK_SECRET:'mock-signing-key',INSTAGRAM_CONNECTION_PROVIDER:'zernio',MESSAGING_ENABLED:'true'};
let callback;const profile='a'.repeat(24),account='b'.repeat(24),errors=[];
env.ZERNIO_FETCH=async(input,options={})=>{
 const url=new URL(input);
 if(url.pathname==='/api/v1/profiles'&&options.method==='GET')return Response.json({profiles:[]});
 if(url.pathname==='/api/v1/profiles')return Response.json({profile:{_id:profile,externalId:JSON.parse(options.body).externalId}},{status:201});
 if(url.pathname==='/api/v1/connect/instagram'){callback=new URL(url.searchParams.get('redirect_url'));return Response.json({authUrl:'https://zernio.com/mock-approval'});}
 if(url.pathname==='/api/v1/accounts')return Response.json({accounts:[{_id:account,profileId:profile,platform:'instagram',platformUserId:'123456',username:'zernio_browser_test',isActive:true}]});
 throw Error('Unexpected mocked provider request');
};
let browser;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});const context=await browser.newContext();
 await context.addCookies([{name:'fn_session',value:await sessionFor('u',env),url:'https://flownex.online',httpOnly:true,secure:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.href==='https://zernio.com/mock-approval'){callback.searchParams.set('connected','instagram');callback.searchParams.set('profileId',profile);callback.searchParams.set('accountId',account);await route.fulfill({status:200,contentType:'text/html',body:'<script>location.replace('+JSON.stringify(callback.href)+')</script>'});return;}
  if(url.origin!=='https://flownex.online')throw Error('External network blocked');
  if(url.pathname.startsWith('/assets/')){await route.fulfill({status:200,contentType:'image/svg+xml',body:readFileSync(new URL('../public'+url.pathname,import.meta.url))});return;}
  const body=request.postDataBuffer(),response=await runtime.fetch(new Request(url,{method:request.method(),headers:await request.allHeaders(),...(body?{body}:{})}),env);
  if(response.status===302){await route.fulfill({status:200,contentType:'text/html',body:'<script>location.replace('+JSON.stringify(response.headers.get('location'))+')</script>'});return;}
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto('https://flownex.online/app');await page.getByRole('button',{name:'Conectar Instagram',exact:true}).click();
 await page.getByText('@zernio_browser_test',{exact:true}).waitFor();
 const saved=await db.prepare('SELECT * FROM instagram_accounts').first();assert.equal(saved.ig_user_id,'zernio:'+account);assert.equal(saved.encrypted_token,null);
 assert.equal(new URL(page.url()).search,'');assert.equal(await page.evaluate(()=>document.documentElement.outerHTML.includes('mock-server-only-provider-key')),false);assert.deepEqual(errors,[]);
 console.log('BROWSER_ZERNIO_OK',JSON.stringify({checks:4,actualConnections:0,actualSends:0}));
}finally{await browser?.close();db.close();}
