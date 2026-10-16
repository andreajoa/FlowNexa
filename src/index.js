import {refreshAccounts,deauthorize} from './account-lifecycle.js';
import {legalPage} from './legal.js';
import {appPage} from './app-ui.js';
import {appClient} from './app-client.js';
import {instagramOauth} from './instagram-oauth.js';
import {accountApi} from './auth.js';
import {runtimeApi} from './runtime-api.js';
import {enqueueWebhook,processPending} from './automation-engine.js';
import {respond as json,sha} from './identity.js';
import {messagingReady} from './meta-client.js';
export const TEMPLATES=[{id:'comment-link',name:'Comentou QUERO',trigger_type:'comment_keyword',scope:'selected',configuration:{keywords:['QUERO'],actions:[{type:'private_reply',text:'Aqui está o link solicitado.'}]}}];
export function keywordMatch(content,words){const text=String(content||'').normalize('NFKC').toLocaleUpperCase('pt-BR');return Array.isArray(words)&&words.some(w=>String(w).trim()&&text.includes(String(w).normalize('NFKC').toLocaleUpperCase('pt-BR')))}
export function mediaMatch(scope,selected,mediaId){return scope==='all'||scope==='selected'&&Array.isArray(selected)&&selected.includes(mediaId)}
export function evaluate(flow,event){const c=typeof flow.configuration==='string'?JSON.parse(flow.configuration):flow.configuration;if(!mediaMatch(flow.scope,c.media_ids||[],event.media_id))return{matched:false,reason:'scope'};if(flow.trigger_type.endsWith('_keyword')&&!keywordMatch(event.text,c.keywords))return{matched:false,reason:'keyword'};return{matched:true,actions:c.actions||[]}}
export async function verifySignature(payload,signature,secret){if(!signature?.startsWith("sha256=")||!secret)return false;const encoder=new TextEncoder();const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const expected=new Uint8Array(await crypto.subtle.sign("HMAC",key,payload));const supplied=signature.slice(7);if(!/^[a-f0-9]{64}$/i.test(supplied))return false;const actual=Uint8Array.from(supplied.match(/../g),x=>parseInt(x,16));let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^actual[i];return diff===0}

export default {async fetch(request,env,ctx={}){
 const url=new URL(request.url),path=url.pathname;
 const legal=legalPage(path);if(legal&&request.method==='GET')return new Response(legal,{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff'}});
 if(request.method==='GET'&&['/app','/app/','/app.js'].includes(path)){
  const script=path==='/app.js';return new Response(script?appClient():appPage(),{headers:{'content-type':script?'application/javascript; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
 }
 if(path==='/api/health'&&request.method==='GET'){
  if(!env.DB)return json({status:'degraded',database:false},503);
  try{await env.DB.prepare('SELECT 1 AS ok FROM auth_tokens LIMIT 1').first();return json({status:'ok',app:'FlowNexa',liveMessaging:messagingReady(env),instagramConfigured:Boolean(env.META_APP_ID&&env.META_APP_SECRET)});}catch{return json({status:'degraded',database:false},503);}
 }
 if(path==='/api/internal/tick'){
  const token=request.headers.get('authorization');if(request.method!=='POST'||!env.CRON_SECRET||!token||await sha(token)!==await sha('Bearer '+env.CRON_SECRET))return json({error:'forbidden'},403);
  const [queue,accounts]=await Promise.all([processPending(env),refreshAccounts(env)]);return json({...queue,accounts});
 }
 if(path==='/api/instagram/deauthorize')return deauthorize(request,env);
 if(path.startsWith('/api/instagram/'))return instagramOauth(request,env);
 if(path.startsWith('/api/auth/')||path==='/api/workspaces'||path==='/api/accounts')return accountApi(request,env);
 if(path==='/api/flows'||path.startsWith('/api/flows/')||path.startsWith('/api/accounts/')||path==='/api/executions')return runtimeApi(request,env);
 if(path==='/api/templates'&&request.method==='GET')return json({templates:TEMPLATES});
 if(path==='/webhooks/instagram'&&request.method==='GET'){
  const token=url.searchParams.get('hub.verify_token'),challenge=url.searchParams.get('hub.challenge');return env.META_VERIFY_TOKEN&&token===env.META_VERIFY_TOKEN&&url.searchParams.get('hub.mode')==='subscribe'&&challenge?new Response(challenge):json({error:'forbidden'},403);
 }
 if(path==='/webhooks/instagram'&&request.method==='POST'){
  const reader=request.body?.getReader();if(!reader)return json({error:'invalid_payload'},400);let size=0,chunks=[];
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>1048576){await reader.cancel();return json({error:'payload_too_large'},413);}chunks.push(r.value);}
  const body=new Uint8Array(size);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.length;}
  if(!await verifySignature(body,request.headers.get('x-hub-signature-256'),env.META_APP_SECRET))return json({error:'invalid_signature'},403);
  if(!env.DB||!env.TOKEN_ENCRYPTION_KEY)return json({error:'database_unavailable'},503);
  let parsed;try{parsed=JSON.parse(new TextDecoder().decode(body));}catch{return json({error:'invalid_payload'},400);}
  try{const queued=await enqueueWebhook(parsed,env);if(ctx.waitUntil)ctx.waitUntil(processPending(env).catch(()=>{}));return json({received:true,queued});}catch{return json({error:'queue_unavailable'},503);}
 }
 return json({error:'not_found'},404);
}};
