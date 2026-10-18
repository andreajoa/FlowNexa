import {getSessionUser,requireMembership,cookieToken} from './identity.js';
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function aesKey(key){if(!/^[a-f0-9]{64}$/i.test(key||""))throw Error("missing_encryption_key");return crypto.subtle.importKey("raw",Uint8Array.from(key.match(/../g),h=>parseInt(h,16)),"AES-GCM",false,["encrypt","decrypt"])}
export async function encryptToken(token,key){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:"AES-GCM",iv},await aesKey(key),enc.encode(token));return "v1."+b64(iv)+"."+b64(data)}
export async function decryptToken(stored,key){const [v,nonce,cipher]=String(stored).split(".");if(v!=="v1")throw Error("bad_token_format");const output=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(nonce)},await aesKey(key),unb64(cipher));return new TextDecoder().decode(output)}
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v))),c=>c.toString(16).padStart(2,"0")).join("");
export const INSTAGRAM_SCOPES=['instagram_business_basic','instagram_business_manage_messages','instagram_business_manage_comments'];
const validToken=token=>typeof token==='string'&&token.length>0&&token.length<=16384;
export function subscriptionConfirmed(response,payload){return response.ok===true&&payload?.success===true;}
export async function instagramOauth(request,env){
const url=new URL(request.url);
// Navigation returns to the app with a fixed error code, never provider payloads or tokens.
const J=(data,status=200)=>{
 if(status>=400&&url.pathname==='/api/instagram/callback'&&request.headers.get('accept')?.includes('text/html')){
  const target=new URL('/app',url.origin);target.searchParams.set('error',data.error);if(data.reference)target.searchParams.set('connection_ref',data.reference);
  return new Response(null,{status:302,headers:{location:target.href,'cache-control':'no-store','referrer-policy':'no-referrer'}});
 }
 return json(data,status);
};
let step='configuration';
const failed=(error,response,data)=>{
 const reference=crypto.randomUUID();
 // Only allowlisted metadata is logged: never URLs, messages, secrets or provider bodies.
 const detail={event:'instagram_oauth_failed',reference,step,error,provider_status:response?.status||null,provider_code:Number.isSafeInteger(data?.error?.code)?data.error.code:null,provider_subcode:Number.isSafeInteger(data?.error?.error_subcode)?data.error.error_subcode:null,provider_trace:/^[A-Za-z0-9_-]{1,200}$/.test(data?.error?.fbtrace_id||'')?data.error.fbtrace_id:null,unsupported_get:/Unsupported request - method type: get/i.test(typeof data?.error?.message==='string'?data.error.message:'')};
 (env.OAUTH_LOG||console.warn)(JSON.stringify(detail));
 return J({error,reference},error==='instagram_permissions_missing'?403:502);
};
if(!env.DB||!env.META_APP_ID||!env.META_APP_SECRET||!env.TOKEN_ENCRYPTION_KEY)return J({error:"meta_configuration_missing"},503);
const version=env.META_API_VERSION||"v24.0";if(!/^v\d+\.0$/.test(version))return J({error:"invalid_meta_version"},503);
if(request.method!=="GET")return J({error:"method_not_allowed"},405);
const user=await getSessionUser(request,env);if(!user)return J({error:"unauthorized"},401);
const redirect=env.META_REDIRECT_URI;
if(!redirect||!redirect.startsWith("https://"))return J({error:"redirect_uri_missing"},503);
if(url.pathname==="/api/instagram/connect"){

const workspace=url.searchParams.get("workspace");
const member=await env.DB.prepare("SELECT role FROM memberships WHERE workspace_id=? AND user_id=?").bind(workspace,user.id).first();
if(!member||!["owner","admin"].includes(member.role))return J({error:"forbidden"},403);
const state=crypto.randomUUID()+crypto.randomUUID(),stateHash=await hash(state+":"+cookieToken(request));
await env.DB.prepare("INSERT INTO oauth_states(state_hash,user_id,workspace_id,expires_at) VALUES (?,?,?,?)").bind(stateHash,user.id,workspace,Math.floor(Date.now()/1000)+600).run();
const p=new URLSearchParams({client_id:env.META_APP_ID,redirect_uri:redirect,response_type:"code",scope:INSTAGRAM_SCOPES.join(","),state,enable_fb_login:"0",force_authentication:"1"});
return J({authorization_url:"https://www.instagram.com/oauth/authorize?"+p.toString()});
}
if(url.pathname==="/api/instagram/callback"){
try{
const state=url.searchParams.get("state"),code=url.searchParams.get("code");
if(!state)return J({error:"invalid_state"},403);
const stateHash=await hash(state+":"+cookieToken(request));
const stateRow=await env.DB.prepare("SELECT user_id,workspace_id FROM oauth_states WHERE state_hash=? AND expires_at>?").bind(stateHash,Math.floor(Date.now()/1000)).first();
if(!stateRow||stateRow.user_id!==user.id)return J({error:"invalid_state"},403);
if(!await requireMembership(env.DB,user.id,stateRow.workspace_id,["owner","admin"]))return J({error:"forbidden"},403);
const del=await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash=? AND expires_at>?").bind(stateHash,Math.floor(Date.now()/1000)).run();if(!del.meta.changes)return J({error:"state_used"},403);
if(url.searchParams.has("error")||!code)return J({error:"authorization_declined"},400);
step='code_exchange';
const form=new URLSearchParams({client_id:env.META_APP_ID,client_secret:env.META_APP_SECRET,grant_type:"authorization_code",redirect_uri:redirect,code});
const exchange=await (env.META_FETCH||fetch)("https://api.instagram.com/oauth/access_token",{method:"POST",body:form,redirect:"error",signal:AbortSignal.timeout(10000)});
const shortPayload=await exchange.json().catch(()=>({}));
const short=validToken(shortPayload?.access_token)&&!shortPayload.data?shortPayload:!shortPayload?.access_token&&Array.isArray(shortPayload?.data)&&shortPayload.data.length===1?shortPayload.data[0]:null;
if(!exchange.ok||!validToken(short?.access_token))return failed('token_exchange_failed',exchange,shortPayload);
if(short.permissions!==undefined&&(!Array.isArray(short.permissions)||!INSTAGRAM_SCOPES.every(scope=>short.permissions.includes(scope))))return failed('instagram_permissions_missing');
// A short-lived token must never be persisted as a renewable long-lived credential.
step='long_token_exchange';
const longer=new URL("https://graph.instagram.com/access_token");
longer.search=new URLSearchParams({grant_type:"ig_exchange_token",client_secret:env.META_APP_SECRET,access_token:short.access_token}).toString();
const long=await (env.META_FETCH||fetch)(longer,{method:"GET",redirect:"error",signal:AbortSignal.timeout(10000)});
const tokenData=(await long.json().catch(()=>null))||{};
if(!long.ok||!validToken(tokenData.access_token)||!Number.isSafeInteger(tokenData.expires_in)||tokenData.expires_in<=86400||tokenData.expires_in>90*86400)return failed('long_token_exchange_failed',long,tokenData);
const activeToken=tokenData.access_token,lifetime=tokenData.expires_in;
// Use the versioned Instagram Login API, not the legacy unversioned /me route.
// user_id is the professional account ID used by webhooks; id is another namespace.
step='profile';
const profileUrl=new URL(`https://graph.instagram.com/${version}/me`);
profileUrl.search=new URLSearchParams({fields:"user_id,username"}).toString();
const response=await (env.META_FETCH||fetch)(profileUrl,{method:"GET",headers:{authorization:"Bearer "+activeToken},redirect:"error",signal:AbortSignal.timeout(10000)});
const profile=(await response.json().catch(()=>null))||{};
if(!response.ok||typeof profile.username!=="string"||!profile.username||!/^\d{1,50}$/.test(String(profile.user_id||"")))return failed('instagram_profile_failed',response,profile);
const id=crypto.randomUUID();const encrypted=await encryptToken(activeToken,env.TOKEN_ENCRYPTION_KEY);
const igId=String(profile.user_id);
const existing=await env.DB.prepare("SELECT workspace_id FROM instagram_accounts WHERE ig_user_id=?").bind(igId).first();
if(existing&&existing.workspace_id!==stateRow.workspace_id)return J({error:"instagram_account_already_connected_to_other_workspace"},409);
const expire=Math.floor(Date.now()/1000)+lifetime;
step='subscription';
const subscriptionUrl=`https://graph.instagram.com/${version}/me/subscribed_apps`;
const subscribed=await (env.META_FETCH||fetch)(subscriptionUrl,{method:'POST',headers:{authorization:'Bearer '+activeToken,'content-type':'application/json'},body:JSON.stringify({subscribed_fields:'comments,messages,messaging_postbacks'}),redirect:'error',signal:AbortSignal.timeout(10000)});
// The authenticated POST success is Meta's documented account-subscription confirmation.
// GET subscription record IDs are a different namespace, not OAuth/parent app IDs.
const subscriptionResult=await subscribed.json().catch(()=>({}));if(!subscriptionConfirmed(subscribed,subscriptionResult))return failed('instagram_subscription_failed',subscribed,subscriptionResult);
if(!await requireMembership(env.DB,user.id,stateRow.workspace_id,["owner","admin"]))return J({error:"forbidden"},403);
step='persistence';
const saved=await env.DB.prepare("INSERT INTO instagram_accounts(id,workspace_id,username,ig_user_id,encrypted_token,token_expires_at,status) VALUES (?,?,?,?,?,?,'connected') ON CONFLICT(ig_user_id) DO UPDATE SET username=excluded.username,encrypted_token=excluded.encrypted_token,token_expires_at=excluded.token_expires_at,status='connected' WHERE instagram_accounts.workspace_id=excluded.workspace_id").bind(id,stateRow.workspace_id,profile.username,igId,encrypted,expire).run();
if(!saved.meta.changes)return J({error:"instagram_account_already_connected_to_other_workspace"},409);
return new Response(null,{status:302,headers:{"location":new URL("/app?connected=1",url.origin).toString(),"cache-control":"no-store"}});
}catch{return failed('instagram_connection_failed');}
}
return J({error:"not_found"},404)
}
