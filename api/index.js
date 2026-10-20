import runtime from '../src/index.js';
import {D1Rest} from '../src/d1-rest.js';
import {waitUntil} from '@vercel/functions';
import {landingPage} from "../src/landing.js";
import {landingClient} from "../src/landing-script.js";
// Vercel HTTP gateway: the application uses D1 through server-only credentials.
export const config={api:{bodyParser:false}};
const MAX_BODY=1024*1024;
export default async function handler(req,res){
 const pathname=new URL(req.url||"/","https://flownexa.invalid").pathname;
 if(req.method==="GET" && (pathname==="/"||pathname==="/landing.js")){
  const script=pathname==="/landing.js";
  res.statusCode=200;
  res.setHeader("content-type",script?"application/javascript; charset=utf-8":"text/html; charset=utf-8");
  res.setHeader("cache-control",script?"public, max-age=300":"public, max-age=60");
  res.setHeader("x-content-type-options","nosniff");
  if(!script)res.setHeader("content-security-policy","default-src 'self'; img-src 'self' https://images.unsplash.com; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  return res.end(script?landingClient():landingPage());
 }

 const host=req.headers.host;
 if(!host||/[\\/\s]/.test(host)){res.statusCode=400;return res.end('Invalid host');}
 const publicOrigin='https://'+host;
 const origin=req.headers.origin;
 // Signed callbacks and webhooks do not use browser Origin; identity writes enforce it.
 if(origin&&origin!==publicOrigin){res.statusCode=403;return res.end('Forbidden origin');}
 if(req.headers['x-forwarded-proto']&&req.headers['x-forwarded-proto']!=='https'){res.statusCode=403;return res.end('HTTPS required');}
 const headers=new Headers();
 for(const key of ['accept','accept-language','content-type','cookie','x-hub-signature-256','x-zernio-signature','stripe-signature','user-agent','authorization','svix-id','svix-timestamp','svix-signature']){const value=req.headers[key];if(typeof value==='string')headers.set(key,value);}
 if(origin)headers.set('origin',publicOrigin);
 // Vercel overwrites x-vercel-forwarded-for at its edge. Never trust incoming cf-connecting-ip.
 headers.set('cf-connecting-ip',String(req.headers['x-vercel-forwarded-for']||'unknown').split(',')[0].trim());
 let body;
 if(!['GET','HEAD'].includes(req.method)){
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY){res.statusCode=413;return res.end('Payload too large');}chunks.push(chunk);}body=Buffer.concat(chunks);
 }
 try{
  const env={...process.env};
  if(env.CLOUDFLARE_ACCOUNT_ID&&env.CLOUDFLARE_D1_DATABASE_ID&&env.CLOUDFLARE_D1_TOKEN)env.DB=new D1Rest({accountId:env.CLOUDFLARE_ACCOUNT_ID,databaseId:env.CLOUDFLARE_D1_DATABASE_ID,token:env.CLOUDFLARE_D1_TOKEN});
  const target=new URL(req.url||'/',publicOrigin);if(target.origin!==publicOrigin){res.statusCode=400;return res.end('Invalid path');}
  const response=await runtime.fetch(new Request(target,{method:req.method,headers,body}),env,{waitUntil});
  res.statusCode=response.status;
  for(const[key,value]of response.headers)res.setHeader(key,value);
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.statusCode=503;res.end('Service temporarily unavailable');}
}
