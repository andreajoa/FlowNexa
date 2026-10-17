import {getSessionUser,requireMembership,cookieToken} from './identity.js';
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function aesKey(key){if(!/^[a-f0-9]{64}$/i.test(key||""))throw Error("missing_encryption_key");return crypto.subtle.importKey("raw",Uint8Array.from(key.match(/../g),h=>parseInt(h,16)),"AES-GCM",false,["encrypt","decrypt"])}
export async function encryptToken(token,key){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:"AES-GCM",iv},await aesKey(key),enc.encode(token));return "v1."+b64(iv)+"."+b64(data)}
export async function decryptToken(stored,key){const [v,nonce,cipher]=String(stored).split(".");if(v!=="v1")throw Error("bad_token_format");const output=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(nonce)},await aesKey(key),unb64(cipher));return new TextDecoder().decode(output)}
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v))),c=>c.toString(16).padStart(2,"0")).join("");
export function subscriptionConfirmed(response,payload){return response.ok===true&&payload?.success===true;}
export async function instagramOauth(request,env){
if(!env.DB||!env.META_APP_ID||!env.META_APP_SECRET||!env.TOKEN_ENCRYPTION_KEY)return J({error:"meta_configuration_missing"},503);
const url=new URL(request.url);
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
const p=new URLSearchParams({client_id:env.META_APP_ID,redirect_uri:redirect,response_type:"code",scope:"instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments",state,enable_fb_login:"0"});
return J({authorization_url:"https://www.instagram.com/oauth/authorize?"+p.toString()});
}
if(url.pathname==="/api/instagram/callback"){
try{
const state=url.searchParams.get("state"),code=url.searchParams.get("code");
if(!state||!code)return J({error:"authorization_declined"},400);
const stateHash=await hash(state+":"+cookieToken(request));
const stateRow=await env.DB.prepare("SELECT user_id,workspace_id FROM oauth_states WHERE state_hash=? AND expires_at>?").bind(stateHash,Math.floor(Date.now()/1000)).first();
if(!stateRow||stateRow.user_id!==user.id)return J({error:"invalid_state"},403);
if(!await requireMembership(env.DB,user.id,stateRow.workspace_id,["owner","admin"]))return J({error:"forbidden"},403);
const del=await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash=?").bind(stateHash).run();if(!del.meta.changes)return J({error:"state_used"},403);
const form=new URLSearchParams({client_id:env.META_APP_ID,client_secret:env.META_APP_SECRET,grant_type:"authorization_code",redirect_uri:redirect,code});
const exchange=await (env.META_FETCH||fetch)("https://api.instagram.com/oauth/access_token",{method:"POST",body:form,signal:AbortSignal.timeout(15000)});
const short=await exchange.json().catch(()=>({}));if(!exchange.ok||!short.access_token)return J({error:"token_exchange_failed",detail:short?.error?.message||short?.error_description||short?.error||null},502);
const longer=new URL("https://graph.instagram.com/access_token");longer.search=new URLSearchParams({grant_type:"ig_exchange_token",client_secret:env.META_APP_SECRET,access_token:short.access_token}).toString();
const long=await (env.META_FETCH||fetch)(longer,{signal:AbortSignal.timeout(15000)});const tokenData=await long.json().catch(()=>({}));if(!long.ok||!tokenData.access_token)return J({error:"long_token_exchange_failed",detail:tokenData?.error?.message||tokenData?.error_description||tokenData?.error||null},502);
const profileUrl=new URL("https://graph.instagram.com/me");profileUrl.search=new URLSearchParams({fields:"user_id,username",access_token:tokenData.access_token}).toString();
const response=await (env.META_FETCH||fetch)(profileUrl,{signal:AbortSignal.timeout(15000)});const profile=await response.json().catch(()=>({}));
if(!response.ok||typeof profile.username!=="string"||!profile.username||!/^\d+$/.test(String(profile.user_id||"")))return J({error:"instagram_profile_failed",detail:profile?.error?.message||profile?.error||null},502);
const id=crypto.randomUUID();const encrypted=await encryptToken(tokenData.access_token,env.TOKEN_ENCRYPTION_KEY);
const igId=String(profile.user_id);
const existing=await env.DB.prepare("SELECT workspace_id FROM instagram_accounts WHERE ig_user_id=?").bind(igId).first();
if(existing&&existing.workspace_id!==stateRow.workspace_id)return J({error:"instagram_account_already_connected_to_other_workspace"},409);
const lifetime=Number(tokenData.expires_in);if(!Number.isFinite(lifetime)||lifetime<3600)return J({error:"invalid_token_expiry"},502);
const expire=Math.floor(Date.now()/1000)+lifetime;
const subscriptionUrl=`https://graph.instagram.com/${env.META_API_VERSION||'v24.0'}/me/subscribed_apps`;
const subscribed=await (env.META_FETCH||fetch)(subscriptionUrl,{method:'POST',headers:{authorization:'Bearer '+tokenData.access_token,'content-type':'application/json'},body:JSON.stringify({subscribed_fields:'comments,messages,messaging_postbacks'}),signal:AbortSignal.timeout(15000)});
// The authenticated POST success is Meta's documented account-subscription confirmation.
// GET subscription record IDs are a different namespace, not OAuth/parent app IDs.
const subscriptionResult=await subscribed.json().catch(()=>({}));if(!subscriptionConfirmed(subscribed,subscriptionResult))return J({error:'instagram_subscription_failed',detail:subscriptionResult?.error?.message||subscriptionResult?.error||null},502);
if(!await requireMembership(env.DB,user.id,stateRow.workspace_id,["owner","admin"]))return J({error:"forbidden"},403);
const saved=await env.DB.prepare("INSERT INTO instagram_accounts(id,workspace_id,username,ig_user_id,encrypted_token,token_expires_at,status) VALUES (?,?,?,?,?,?,'connected') ON CONFLICT(ig_user_id) DO UPDATE SET username=excluded.username,encrypted_token=excluded.encrypted_token,token_expires_at=excluded.token_expires_at,status='connected' WHERE instagram_accounts.workspace_id=excluded.workspace_id").bind(id,stateRow.workspace_id,profile.username,igId,encrypted,expire).run();
if(!saved.meta.changes)return J({error:"instagram_account_already_connected_to_other_workspace"},409);
return new Response(null,{status:302,headers:{"location":new URL("/app?connected=1",url.origin).toString(),"cache-control":"no-store"}});
}catch(err){return J({error:"instagram_connection_failed",detail:err?.message||null},502);}
}
return J({error:"not_found"},404)
}
