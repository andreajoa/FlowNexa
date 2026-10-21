import {getSessionUser,requireMembership,cookieToken,sha,respond as J,sameOrigin,payload,rateLimit} from '../identity.js';
import {zernioRequest} from '../zernio-client.js';
import {billingAccess} from '../billing.js';
import {ensureSchema,enabled,sendsEnabled,configured} from './schema.js';
import {validateTikTokGraph} from './graph.js';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const oid=s=>typeof s==='string'&&/^[a-f0-9]{24}$/i.test(s);
const profileId=p=>typeof p==='string'?p:p?._id;
const safeFlow=f=>({...f,graph:JSON.parse(f.graph),keywords:JSON.parse(f.keywords)});
export function flowInput(b){
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100||!['dm_any','dm_keyword','comment_any','comment_keyword'].includes(b.trigger_type))throw fail('tiktok_invalid_flow');
 if(!Array.isArray(b.keywords)||b.keywords.length>10||b.keywords.some(k=>typeof k!=='string'||!k.trim()||k.length>40)||b.trigger_type.endsWith('keyword')&&!b.keywords.length)throw fail('tiktok_invalid_keywords');
 const valid=validateTikTokGraph(b.graph);if(!valid.ok)throw fail(valid.error);
 if(b.trigger_type.startsWith('comment')&&b.graph.nodes.some(n=>n.type==='wait_reply'))throw fail('tiktok_comment_wait_unsupported');
 return{name:b.name.trim(),trigger_type:b.trigger_type,keywords:JSON.stringify(b.keywords.map(k=>k.trim())),graph:JSON.stringify(b.graph)};
}
async function ensureProfile(env,workspace,origin){
 let p=await env.DB.prepare('SELECT profile_id FROM tiktok_profiles WHERE workspace_id=?').bind(workspace).first();if(p)return p.profile_id;
 const externalId='flownexa:tiktok:'+origin+':'+workspace;let result=await zernioRequest(env,'profiles?externalId='+encodeURIComponent(externalId)),list=(result.profiles||[]).filter(p=>p.externalId===externalId);
 if(!list.length){try{const r=await zernioRequest(env,'profiles',{method:'POST',body:{name:'FlowNexa TikTok '+workspace,externalId}});list=[r.profile];}catch(e){if(e.status!==409)throw e;result=await zernioRequest(env,'profiles?externalId='+encodeURIComponent(externalId));list=(result.profiles||[]).filter(p=>p.externalId===externalId);}}
 if(list.length!==1||!oid(list[0]?._id)||list[0].externalId!==externalId)throw fail('tiktok_provider_response',502);
 await env.DB.prepare('INSERT OR IGNORE INTO tiktok_profiles(workspace_id,profile_id) VALUES(?,?)').bind(workspace,list[0]._id).run();p=await env.DB.prepare('SELECT profile_id FROM tiktok_profiles WHERE workspace_id=?').bind(workspace).first();return p.profile_id;
}
export async function tiktokApi(request,env){
 const url=new URL(request.url),path=url.pathname,callback=path==='/api/tiktok/callback';let workspace;
 try{
  const user=await getSessionUser(request,env);if(!user)throw fail('unauthorized',401);
  if(!['GET','POST'].includes(request.method))throw fail('method_not_allowed',405);
  if(request.method==='POST'&&!sameOrigin(request))throw fail('forbidden_origin',403);
  if(callback){
   if(request.method!=='GET'||!enabled(env))throw fail('tiktok_not_configured',503);await ensureSchema(env);
   const state=url.searchParams.get('fn_state');if(!state||state.length>200)throw fail('invalid_state',403);
   const row=await env.DB.prepare('DELETE FROM tiktok_oauth WHERE state_hash=? AND user_id=? AND expires_at>? RETURNING *').bind(await sha(state+':'+cookieToken(request)),user.id,Date.now()).first();
   if(!row||!await requireMembership(env.DB,user.id,row.workspace_id,['owner','admin']))throw fail('invalid_state',403);workspace=row.workspace_id;
   if(url.searchParams.has('error'))throw fail(url.searchParams.get('error')==='missing_tiktok_permissions'?'tiktok_permissions_missing':'tiktok_authorization_failed',409);
   const remote=url.searchParams.get('accountId');if(url.searchParams.get('connected')!=='tiktok'||url.searchParams.get('profileId')!==row.profile_id||!oid(remote))throw fail('tiktok_authorization_failed',409);
   const r=await zernioRequest(env,'accounts?'+new URLSearchParams({profileId:row.profile_id,platform:'tiktok'}));
   const a=r.accounts?.find(a=>a._id===remote&&a.platform==='tiktok'&&profileId(a.profileId)===row.profile_id);
   if(!a||a.isActive!==true||a.needsReconnection||a.enabled===false||typeof a.platformUserId!=='string'||!a.platformUserId||a.platformUserId.length>200)throw fail('tiktok_authorization_failed',409);
   const matches=(await env.DB.prepare('SELECT * FROM tiktok_accounts WHERE remote_id=? OR native_id=?').bind(remote,a.platformUserId).all()).results;
   if(matches.some(a=>a.workspace_id!==workspace||a.profile_id!==row.profile_id||a.remote_id!==remote))throw fail('tiktok_account_already_connected',409);
   if(matches.some(existing=>existing.native_id!==a.platformUserId))throw fail('tiktok_account_identity_changed',409);
   if(row.reconnect_id&&!matches.some(a=>a.id===row.reconnect_id))throw fail('tiktok_account_identity_changed',409);
   const id=matches[0]?.id||crypto.randomUUID();
   await env.DB.prepare("INSERT INTO tiktok_accounts(id,workspace_id,remote_id,profile_id,native_id,name,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(remote_id) DO UPDATE SET name=excluded.name,status='connected' WHERE tiktok_accounts.workspace_id=excluded.workspace_id").bind(id,workspace,remote,row.profile_id,a.platformUserId,String(a.displayName||a.username||'TikTok Business').slice(0,200),Date.now()).run();
   return new Response(null,{status:303,headers:{location:'/app?workspace='+encodeURIComponent(workspace)+'&tiktok_connected=1#tiktok-channel','cache-control':'no-store','referrer-policy':'no-referrer'}});
  }
  const b=request.method==='POST'?await payload(request,32000):{};workspace=request.method==='GET'?url.searchParams.get('workspace'):b.workspace_id;
  const member=await requireMembership(env.DB,user.id,workspace);if(!member)throw fail('forbidden',403);const manage=['owner','admin'].includes(member.role);
  if(path==='/api/tiktok/status'&&request.method==='GET')return J({configured:configured(env),enabled:enabled(env),sends_enabled:sendsEnabled(env),can_manage:manage});
  if(!enabled(env))throw fail('tiktok_not_configured',503);await ensureSchema(env);
  if(request.method==='GET'){
   if(path==='/api/tiktok/accounts')return J({accounts:(await env.DB.prepare('SELECT id,name,status FROM tiktok_accounts WHERE workspace_id=? ORDER BY created_at').bind(workspace).all()).results});
   if(path==='/api/tiktok/flows')return J({flows:(await env.DB.prepare('SELECT * FROM tiktok_flows WHERE workspace_id=? ORDER BY created_at DESC').bind(workspace).all()).results.map(safeFlow)});
   if(path==='/api/tiktok/executions')return J({executions:(await env.DB.prepare('SELECT id,flow_id,status,error,attempt_at,completed_at FROM tiktok_jobs WHERE workspace_id=? ORDER BY rowid DESC LIMIT 50').bind(workspace).all()).results});
  }
  if(!manage)throw fail('forbidden',403);
  if(path==='/api/tiktok/connect'&&request.method==='POST'){
   if(!await billingAccess(env,workspace))throw fail('billing_subscription_required',402);
   if(!await rateLimit(request,env,'tiktok_connect',user.email))throw fail('rate_limited',429);
   const existing=b.reconnect_id?await env.DB.prepare('SELECT * FROM tiktok_accounts WHERE id=? AND workspace_id=?').bind(b.reconnect_id,workspace).first():null;if(b.reconnect_id&&!existing)throw fail('tiktok_account_not_found',404);
   if(!existing&&(await env.DB.prepare('SELECT count(*) n FROM tiktok_accounts WHERE workspace_id=?').bind(workspace).first()).n>=5)throw fail('tiktok_account_limit',409);
   const profile=await ensureProfile(env,workspace,url.origin),state=crypto.randomUUID()+crypto.randomUUID();
   await env.DB.prepare('INSERT INTO tiktok_oauth(state_hash,user_id,workspace_id,profile_id,reconnect_id,expires_at) VALUES(?,?,?,?,?,?)').bind(await sha(state+':'+cookieToken(request)),user.id,workspace,profile,existing?.id||null,Date.now()+600000).run();
   const redirect=new URL('/api/tiktok/callback',url.origin);redirect.searchParams.set('fn_state',state);
   const result=await zernioRequest(env,'connect/tiktok?'+new URLSearchParams({profileId:profile,redirect_url:redirect.href,...(existing?{reconnectAccountId:existing.remote_id}:{})}));let auth;try{auth=new URL(result.authUrl);}catch{throw fail('tiktok_provider_response',502);}
   if(auth.protocol!=='https:'||auth.username||auth.password||!['zernio.com','www.zernio.com','tiktok.com','www.tiktok.com','business-api.tiktok.com','business.tiktok.com'].includes(auth.hostname))throw fail('tiktok_provider_response',502);
   return J({authorization_url:auth.href});
  }
  const accountMatch=path.match(/^\/api\/tiktok\/accounts\/([^/]+)\/disconnect$/);
  if(accountMatch&&request.method==='POST'){
   const a=await env.DB.prepare('SELECT * FROM tiktok_accounts WHERE id=? AND workspace_id=?').bind(accountMatch[1],workspace).first();if(!a)throw fail('tiktok_account_not_found',404);
   await env.DB.batch([env.DB.prepare("UPDATE tiktok_accounts SET status='disconnected' WHERE id=?").bind(a.id),env.DB.prepare('UPDATE tiktok_flows SET enabled=0,version=version+1 WHERE account_id=?').bind(a.id),env.DB.prepare("UPDATE tiktok_jobs SET status='cancelled',encrypted_action='',error='account_disconnected' WHERE account_id=? AND status='pending'").bind(a.id),env.DB.prepare('DELETE FROM tiktok_sessions WHERE account_id=?').bind(a.id)]);
   return J({disconnected:true});
  }
  const match=path.match(/^\/api\/tiktok\/flows\/([^/]+)(?:\/(publish|pause))?$/);
  if(request.method==='POST'&&(path==='/api/tiktok/flows'||match)){
   const flow=match?await env.DB.prepare('SELECT * FROM tiktok_flows WHERE id=? AND workspace_id=?').bind(match[1],workspace).first():null;if(match&&!flow)throw fail('tiktok_flow_not_found',404);
   if(flow&&(!Number.isSafeInteger(b.version)||b.version!==flow.version))throw fail('tiktok_flow_changed',409);
   const operation=match?.[2];
   if(operation==='pause'){await env.DB.batch([env.DB.prepare('UPDATE tiktok_flows SET enabled=0,version=version+1 WHERE id=? AND version=?').bind(flow.id,flow.version),env.DB.prepare("UPDATE tiktok_jobs SET status='cancelled',encrypted_action='',error='flow_paused' WHERE flow_id=? AND status='pending'").bind(flow.id)]);return J({flow:safeFlow(await env.DB.prepare('SELECT * FROM tiktok_flows WHERE id=?').bind(flow.id).first())});}
   if(!await billingAccess(env,workspace))throw fail('billing_subscription_required',402);
   const account=await env.DB.prepare("SELECT id FROM tiktok_accounts WHERE id=? AND workspace_id=? AND status='connected'").bind(flow?.account_id||b.account_id,workspace).first();if(!account)throw fail('tiktok_account_not_connected',409);
   if(operation==='publish'){
    if(!sendsEnabled(env))throw fail('tiktok_sends_disabled',409);flowInput({...flow,keywords:JSON.parse(flow.keywords),graph:JSON.parse(flow.graph)});
    const result=await env.DB.prepare("UPDATE tiktok_flows SET enabled=1,version=version+1,published_at=? WHERE id=? AND version=? AND NOT EXISTS(SELECT 1 FROM tiktok_flows other WHERE other.account_id=? AND other.id<>? AND other.enabled=1 AND other.trigger_type LIKE ?)").bind(Date.now(),flow.id,flow.version,flow.account_id,flow.id,flow.trigger_type.startsWith('dm_')?'dm_%':'comment_%').run();if(!result.meta.changes)throw fail('tiktok_flow_conflict',409);
   }else{
    const fields=flowInput(b),id=flow?.id||crypto.randomUUID();
    if(flow){if(b.account_id!==flow.account_id)throw fail('tiktok_account_identity_changed',409);const r=await env.DB.prepare('UPDATE tiktok_flows SET name=?,trigger_type=?,keywords=?,graph=?,enabled=0,version=version+1 WHERE id=? AND version=?').bind(fields.name,fields.trigger_type,fields.keywords,fields.graph,id,flow.version).run();if(!r.meta.changes)throw fail('tiktok_flow_changed',409);}
    else{if((await env.DB.prepare('SELECT count(*) n FROM tiktok_flows WHERE workspace_id=?').bind(workspace).first()).n>=50)throw fail('tiktok_flow_limit',409);await env.DB.prepare('INSERT INTO tiktok_flows(id,workspace_id,account_id,name,trigger_type,keywords,graph,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,workspace,account.id,fields.name,fields.trigger_type,fields.keywords,fields.graph,Date.now()).run();}
    return J({flow:safeFlow(await env.DB.prepare('SELECT * FROM tiktok_flows WHERE id=?').bind(id).first())});
   }
   return J({flow:safeFlow(await env.DB.prepare('SELECT * FROM tiktok_flows WHERE id=?').bind(flow.id).first())});
  }
  return J({error:'not_found'},404);
 }catch(e){const code=/^(tiktok_|invalid_|graph_|unsupported_|unreachable_|billing_|forbidden|unauthorized|rate_limited)/.test(e.message)?e.message:'tiktok_request_failed';if(callback)return new Response(null,{status:303,headers:{location:'/app?tiktok_error='+encodeURIComponent(code)+(workspace?'&workspace='+encodeURIComponent(workspace):'')+'#tiktok-channel','cache-control':'no-store','referrer-policy':'no-referrer'}});return J({error:code},e.status||503);}
}
