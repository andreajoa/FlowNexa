import {withBillingAccountCapacity,billingAccess} from './billing.js';
import {getSessionUser,requireMembership,cookieToken,sha,respond as J,nowSeconds} from './identity.js';
import {zernioRequest} from './zernio-client.js';
// Additive, idempotent bootstrap: no existing account, token or flow is rewritten.
export const ZERNIO_SCHEMA=[
 'CREATE TABLE IF NOT EXISTS zernio_profiles(workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,profile_id TEXT NOT NULL UNIQUE)',
 'CREATE TABLE IF NOT EXISTS zernio_oauth_states(state_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,workspace_id TEXT NOT NULL,profile_id TEXT NOT NULL,expires_at INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS zernio_accounts(account_id TEXT PRIMARY KEY REFERENCES instagram_accounts(id) ON DELETE CASCADE,remote_id TEXT NOT NULL UNIQUE,profile_id TEXT NOT NULL,platform_user_id TEXT NOT NULL UNIQUE)'
];
export async function ensureZernioSchema(env){for(const sql of ZERNIO_SCHEMA)await env.DB.prepare(sql).run();}
const objectId=id=>typeof id==='string'&&/^[a-f0-9]{24}$/i.test(id);
export const profileIdOf=value=>typeof value==='string'?value:value?._id;
const trustedAuthUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&['zernio.com','www.zernio.com','www.instagram.com','www.facebook.com','instagram.com'].includes(url.hostname)?url.href:null;}catch{return null;}};
export async function zernioConnection(request,env){
 const url=new URL(request.url),callback=url.pathname==='/api/instagram/zernio/callback';
 const fail=(error,status=502)=>{
  if(callback&&request.headers.get('accept')?.includes('text/html')){const target=new URL('/app',url.origin);target.searchParams.set('error',error);return new Response(null,{status:302,headers:{location:target.href,'cache-control':'no-store','referrer-policy':'no-referrer'}});}
  return J({error},status);
 };
 if(request.method!=='GET')return fail('method_not_allowed',405);
 if(!env.DB||!env.ZERNIO_API_KEY||!env.ZERNIO_WEBHOOK_SECRET||!env.TOKEN_ENCRYPTION_KEY)return fail('zernio_configuration_missing',503);
 const user=await getSessionUser(request,env);if(!user)return fail('unauthorized',401);
 try{
  await ensureZernioSchema(env);
  if(!callback){
   const workspace=url.searchParams.get('workspace');if(!await requireMembership(env.DB,user.id,workspace,['owner','admin']))return fail('forbidden',403);
   if(!await billingAccess(env,workspace))return fail('billing_subscription_required',402);
   const externalId=`flownexa:${url.origin}:${workspace}`;
   let row=await env.DB.prepare('SELECT profile_id FROM zernio_profiles WHERE workspace_id=?').bind(workspace).first();
   if(!row){
    let result=await zernioRequest(env,'profiles?externalId='+encodeURIComponent(externalId));
    let profiles=(result.profiles||[]).filter(p=>p.externalId===externalId);
    if(!profiles.length){
     try{result=await zernioRequest(env,'profiles',{method:'POST',body:{name:'FlowNexa '+workspace,externalId}});profiles=[result.profile];}
     catch(error){if(error.status!==409)throw error;result=await zernioRequest(env,'profiles?externalId='+encodeURIComponent(externalId));profiles=(result.profiles||[]).filter(p=>p.externalId===externalId);}
    }
    if(profiles.length!==1||!objectId(profiles[0]?._id)||profiles[0].externalId!==externalId)throw Error('zernio_invalid_response');
    await env.DB.prepare('INSERT OR IGNORE INTO zernio_profiles(workspace_id,profile_id) VALUES(?,?)').bind(workspace,profiles[0]._id).run();
    row=await env.DB.prepare('SELECT profile_id FROM zernio_profiles WHERE workspace_id=?').bind(workspace).first();
   }
   const state=crypto.randomUUID()+crypto.randomUUID(),hash=await sha(state+':'+cookieToken(request));
   await env.DB.prepare('INSERT INTO zernio_oauth_states(state_hash,user_id,workspace_id,profile_id,expires_at) VALUES(?,?,?,?,?)').bind(hash,user.id,workspace,row.profile_id,nowSeconds()+600).run();
   const redirect=new URL('/api/instagram/zernio/callback',url.origin);redirect.searchParams.set('fn_state',state);
   const params=new URLSearchParams({profileId:row.profile_id,redirect_url:redirect.href,loginMethod:'instagram_login',scopes:'comments,messaging',forceReauth:'true'});
   const result=await zernioRequest(env,'connect/instagram?'+params);
   const authorization_url=trustedAuthUrl(result.authUrl);if(!authorization_url)throw Error('zernio_invalid_response');
   return J({authorization_url});
  }
  const state=url.searchParams.get('fn_state');if(!state||state.length>200)return fail('invalid_state',403);
  const hash=await sha(state+':'+cookieToken(request));
  const row=await env.DB.prepare('SELECT * FROM zernio_oauth_states WHERE state_hash=? AND expires_at>?').bind(hash,nowSeconds()).first();
  if(!row||row.user_id!==user.id)return fail('invalid_state',403);
  if(!await requireMembership(env.DB,user.id,row.workspace_id,['owner','admin']))return fail('forbidden',403);
  const removed=await env.DB.prepare('DELETE FROM zernio_oauth_states WHERE state_hash=? AND expires_at>?').bind(hash,nowSeconds()).run();if(!removed.meta.changes)return fail('state_used',403);
  if(url.searchParams.has('error'))return fail('zernio_authorization_failed',400);
  const remoteId=url.searchParams.get('accountId');
  if(url.searchParams.get('connected')!=='instagram'||url.searchParams.get('profileId')!==row.profile_id||!objectId(remoteId))return fail('zernio_authorization_failed',400);
  const result=await zernioRequest(env,'accounts?'+new URLSearchParams({profileId:row.profile_id,platform:'instagram'}));
  const remote=(result.accounts||[]).find(a=>a._id===remoteId&&profileIdOf(a.profileId)===row.profile_id&&a.platform==='instagram');
  if(!remote||remote.isActive!==true||remote.needsReconnection===true||remote.enabled===false||typeof remote.platformUserId!=='string'||!/^\d{1,100}$/.test(remote.platformUserId)||typeof remote.username!=='string'||!/^\w[\w.]{0,29}$/.test(remote.username))return fail('zernio_authorization_failed',409);
  const externalId='zernio:'+remoteId;
  const existing=await env.DB.prepare('SELECT id,workspace_id,ig_user_id FROM instagram_accounts WHERE ig_user_id=? OR (lower(username)=lower(?) AND status=?)').bind(externalId,remote.username,'connected').all();
  if(existing.results.some(a=>a.workspace_id!==row.workspace_id))return fail('instagram_account_already_connected_to_other_workspace',409);
  if(existing.results.some(a=>a.ig_user_id!==externalId))return fail('instagram_account_already_connected',409);
  if(!await requireMembership(env.DB,user.id,row.workspace_id,['owner','admin']))return fail('forbidden',403);
  const localId=existing.results.find(a=>a.ig_user_id===externalId)?.id||crypto.randomUUID();
  await withBillingAccountCapacity(env,row.workspace_id,existing.results.find(a=>a.ig_user_id===externalId)?.id,()=>env.DB.batch([
   env.DB.prepare("INSERT INTO instagram_accounts(id,workspace_id,username,ig_user_id,status) VALUES(?,?,?,?,'connected') ON CONFLICT(ig_user_id) DO UPDATE SET username=excluded.username,status='connected' WHERE instagram_accounts.workspace_id=excluded.workspace_id").bind(localId,row.workspace_id,remote.username,externalId),
   env.DB.prepare('INSERT INTO zernio_accounts(account_id,remote_id,profile_id,platform_user_id) VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET platform_user_id=excluded.platform_user_id WHERE zernio_accounts.profile_id=excluded.profile_id AND zernio_accounts.remote_id=excluded.remote_id').bind(localId,remoteId,row.profile_id,remote.platformUserId)
  ]));
  return new Response(null,{status:302,headers:{location:new URL('/app?connected=1',url.origin).href,'cache-control':'no-store','referrer-policy':'no-referrer'}});
 }catch(error){return fail(error.message==='billing_account_limit'?'billing_account_limit':'zernio_connection_failed',error.message==='billing_account_limit'?409:502);}
}
