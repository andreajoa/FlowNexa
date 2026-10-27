import {appPageEn,appClientEn,appLocale} from './app-en.js';
import {facebookApi} from './facebook-api.js';
import {processFacebookJobs,metaFacebookWebhook} from './facebook-runtime.js';
import {zernioConnection} from './zernio-connection.js';
import {zernioWebhook} from './zernio-webhook.js';
import {processConversations} from './conversation-runtime.js';
import {billingApi,stripeWebhook,ownerExempt} from './billing.js';
import {refreshAccounts,deauthorize} from './account-lifecycle.js';
import {legalPage} from './legal.js';
import {appPage} from './app-ui.js';
import {appClient} from './app-client.js';
import {instagramOauth} from './instagram-oauth.js';
import {accountApi} from './auth.js';
import {runtimeApi} from './runtime-api.js';
import {enqueueWebhook,processPending} from './automation-engine.js';
import {respond as json,sha,getSessionUser,requireMembership} from './identity.js';
import {voiceReady} from './voice-transcription.js';
import {paulReady} from './paul-replies.js';
import {cloudflareConfigured,freeOnly} from './cloudflare-ai.js';
import {messagingReady} from './meta-client.js';
import {agentTokensApi,agentRuntimeApi} from './agent-api.js';
import {mcpHttp} from './mcp-http.js';
export const TEMPLATES=[{id:'comment-link',name:'Comentou QUERO',trigger_type:'comment_keyword',scope:'selected',configuration:{keywords:['QUERO'],actions:[{type:'private_reply',text:'Aqui está o link solicitado.'}]}}];
export function keywordMatch(content,words){const text=String(content||'').normalize('NFKC').toLocaleUpperCase('pt-BR');return Array.isArray(words)&&words.some(w=>String(w).trim()&&text.includes(String(w).normalize('NFKC').toLocaleUpperCase('pt-BR')))}
export function mediaMatch(scope,selected,mediaId){return scope==='all'||scope==='selected'&&Array.isArray(selected)&&selected.includes(mediaId)}
export function evaluate(flow,event){const c=typeof flow.configuration==='string'?JSON.parse(flow.configuration):flow.configuration;if(!mediaMatch(flow.scope,c.media_ids||[],event.media_id))return{matched:false,reason:'scope'};if(flow.trigger_type.endsWith('_keyword')&&!keywordMatch(event.text,c.keywords))return{matched:false,reason:'keyword'};return{matched:true,actions:c.actions||[]}}
export async function verifySignature(payload,signature,secret){if(!signature?.startsWith("sha256=")||!secret)return false;const encoder=new TextEncoder();const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const expected=new Uint8Array(await crypto.subtle.sign("HMAC",key,payload));const supplied=signature.slice(7);if(!/^[a-f0-9]{64}$/i.test(supplied))return false;const actual=Uint8Array.from(supplied.match(/../g),x=>parseInt(x,16));let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^actual[i];return diff===0}

async function processQueue(env){
 const deadline=Date.now()+40000,scoped={...env,RUNTIME_DEADLINE_MS:deadline};
 const queue=await processPending(scoped,10,deadline);
 const conversations=await processConversations(scoped,5,deadline);
 return{...queue,conversations};
}

const app={async fetch(request,env,ctx={}){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/mcp')return mcpHttp(request,env,(req,e)=>app.fetch(req,e));
 const legal=legalPage(path);if(legal&&request.method==='GET')return new Response(legal,{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff'}});
 if(request.method==='GET'&&['/app','/app/','/app.js'].includes(path)){
  const script=path==='/app.js',english=appLocale(request)==='en';return new Response(script?(english?appClientEn():appClient()):(english?appPageEn():appPage('pt-BR')),{headers:{'content-type':script?'application/javascript; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self' https://js.stripe.com https://*.js.stripe.com https://checkout.stripe.com; connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.network https://checkout.stripe.com; frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
 }
 if(path==='/api/health'&&request.method==='GET'){
  if(!env.DB)return json({status:'degraded',database:false},503);
  // Public availability checks must not expose tenants or change their automations.
  try{await env.DB.prepare('SELECT 1 AS ok FROM auth_tokens LIMIT 1').first();return json({status:'ok',app:'FlowNexa'});}catch{return json({status:'degraded',database:false},503);}
 }
 // Authenticated, read-only readiness probe; never reveals credentials or triggers model billing.
 if(path==='/api/voice/status'&&request.method==='GET'){
  if(!env.DB)return json({error:'database_unavailable'},503);
  const user=await getSessionUser(request,env);
  if(!user)return json({error:'unauthorized'},401);
  if(!await requireMembership(env.DB,user.id,url.searchParams.get('workspace')))return json({error:'forbidden'},403);
  const enabled=cloudflareConfigured(env);
  let credential='unconfigured';
  if(enabled){
   try{
    const result=await fetch('https://api.cloudflare.com/client/v4/accounts/'+env.CLOUDFLARE_AI_ACCOUNT_ID+'/tokens/verify',{
      headers:{authorization:'Bearer '+env.CLOUDFLARE_AI_TOKEN},redirect:'error',signal:AbortSignal.timeout(6000),
    });
    const data=await result.json().catch(()=>null);
    credential=result.ok&&data?.success===true&&data.result?.status==='active'?'valid':'invalid';
   }catch{credential='unreachable';}
  }
  return json({provider:'cloudflare',free_only:freeOnly(env),cloudflare_configured:enabled,credential,voice_ready:voiceReady(env),paul_ready:paulReady(env)},200);
 }
 if(path==='/api/internal/tick'){
  const token=request.headers.get('authorization');if(request.method!=='POST'||!env.CRON_SECRET||!token||await sha(token)!==await sha('Bearer '+env.CRON_SECRET))return json({error:'forbidden'},403);
  const [queue,accounts]=await Promise.all([processQueue(env),refreshAccounts(env)]);let facebook;try{facebook=await processFacebookJobs(env,5,Date.now()+8000);}catch{facebook={error:'facebook_queue_unavailable'};}return json({...queue,accounts,facebook});
 }
 if(path==='/webhooks/stripe'&&request.method==='POST')return stripeWebhook(request,env);
 if(path.startsWith('/api/facebook/'))return facebookApi(request,env);
 if(path.startsWith('/api/billing/'))return billingApi(request,env);
 if(path==='/webhooks/zernio'){
  const response=await zernioWebhook(request,env);
  if(response.ok&&ctx.waitUntil)ctx.waitUntil(processQueue(env).catch(()=>{}));
  return response;
 }
 if(path==='/webhooks/facebook')return metaFacebookWebhook(request,env);
 // The owner's own workspaces connect Instagram directly through Meta (free); customers follow the provider setting.
 if(path==='/api/instagram/zernio/callback'||path==='/api/instagram/connect'&&env.INSTAGRAM_CONNECTION_PROVIDER==='zernio'&&!await ownerExempt(env,url.searchParams.get('workspace')||''))return zernioConnection(request,env);
 if(path==='/api/instagram/deauthorize')return deauthorize(request,env);
 if(path.startsWith('/api/instagram/'))return instagramOauth(request,env);
 if(path.startsWith('/api/auth/')||path==='/api/workspaces'||path==='/api/accounts')return accountApi(request,env);
 if(path.startsWith('/api/v1/agent/'))return agentRuntimeApi(request,env);
 if(path==='/api/agent-tokens'||path.startsWith('/api/agent-tokens/'))return agentTokensApi(request,env);
 if(path==='/api/flows'||path.startsWith('/api/flows/')||path.startsWith('/api/accounts/')||path==='/api/executions')return runtimeApi(request,env);
 if(path==='/api/templates'&&request.method==='GET')return json({templates:TEMPLATES});
 if(path==='/webhooks/instagram'&&request.method==='GET'){
  const token=url.searchParams.get('hub.verify_token'),challenge=url.searchParams.get('hub.challenge');return env.META_VERIFY_TOKEN&&token===env.META_VERIFY_TOKEN&&url.searchParams.get('hub.mode')==='subscribe'&&challenge?new Response(challenge):json({error:'forbidden'},403);
 }
 if(path==='/webhooks/instagram'&&request.method==='POST'){
  const reader=request.body?.getReader();if(!reader)return json({error:'invalid_payload'},400);let size=0,chunks=[];
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>1048576){await reader.cancel();return json({error:'payload_too_large'},413);}chunks.push(r.value);}
  const body=new Uint8Array(size);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.length;}
  if(!await verifySignature(body,request.headers.get('x-hub-signature-256'),env.META_WEBHOOK_SECRET))return json({error:'invalid_signature'},403);
  if(!env.DB||!env.TOKEN_ENCRYPTION_KEY)return json({error:'database_unavailable'},503);
  let parsed;try{parsed=JSON.parse(new TextDecoder().decode(body));}catch{return json({error:'invalid_payload'},400);}
  try{const queued=await enqueueWebhook(parsed,env);if(ctx.waitUntil)ctx.waitUntil(processQueue(env).catch(()=>{}));return json({received:true,queued});}catch{return json({error:'queue_unavailable'},503);}
 }
 return json({error:'not_found'},404);
}};
export default app;
