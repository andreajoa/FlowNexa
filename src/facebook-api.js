import {validateFacebookGraph} from './facebook-graph.js';
import {encryptToken} from './instagram-oauth.js';
import {metaConfigured,metaAuthorizationUrl,metaPagesFromCode,subscribeMetaPage,sealPages,openPages,validateOwnApp} from './facebook-meta.js';
import {getSessionUser,requireMembership,cookieToken,sha,respond as J,nowSeconds,sameOrigin,payload} from './identity.js';
import {zernioRequest} from './zernio-client.js';
import {facebookEnabled,facebookAccess,facebookSendsEnabled,facebookMonthlyLimit,ensureFacebookSchema} from './facebook-schema.js';
const oid=id=>typeof id==='string'&&/^[a-f0-9]{24}$/i.test(id);
// Business-portfolio Pages come back as '<userId>:page:<pageId>'; webhooks identify the Page by pageId.
const pageNativeId=id=>typeof id==='string'?id.match(/^(?:\d{1,100}:page:)?(\d{1,100})$/)?.[1]||null:null;
const profileId=p=>typeof p==='string'?p:p?._id;
const safeAccount=a=>({id:a.id,name:a.name,native_id:a.native_id,status:a.status,provider:a.provider||'zernio'});
const safeFlow=f=>{const graph=f.graph?JSON.parse(f.graph):null;return{...f,keywords:JSON.parse(f.keywords),graph,node_count:graph?.nodes?.length||0};};
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export function facebookFlowInput(body){
 const {name,trigger_type,response_kind,keywords=[]}=body;let {response_text}=body,graph=null;
 if(response_kind==='graph'){
  graph=typeof body.graph==='string'?(()=>{try{return JSON.parse(body.graph);}catch{return null;}})():body.graph;
  const checked=validateFacebookGraph(graph);if(!checked.ok)throw fail(checked.error==='facebook_graph_delay_unsupported'?checked.error:'facebook_invalid_graph');
  response_text='Conversa com nós';
 }
 if(typeof name!=='string'||!name.trim()||name.length>100||!['dm_any','dm_keyword','comment_any','comment_keyword'].includes(trigger_type)||typeof response_text!=='string'||!response_text.trim()||response_text.length>2000)throw fail('facebook_invalid_flow');
 if(response_kind!=='graph'&&(trigger_type.startsWith('dm_')?response_kind!=='message':!['public_reply','private_reply'].includes(response_kind)))throw fail('facebook_unsupported_action');
 if(!Array.isArray(keywords)||keywords.length>10||keywords.some(k=>typeof k!=='string'||!k.trim()||k.length>40)||trigger_type.endsWith('_keyword')&&!keywords.length)throw fail('facebook_invalid_keywords');
 return{name:name.trim(),trigger_type,response_kind,response_text:response_text.trim(),keywords:trigger_type.endsWith('_keyword')?keywords.map(k=>k.trim()):[],graph:graph?JSON.stringify(graph):null};
}
async function findOrCreateProfile(env,workspace,origin){
 let row=await env.DB.prepare('SELECT profile_id FROM facebook_profiles WHERE workspace_id=?').bind(workspace).first();if(row)return row.profile_id;
 const externalId=`flownexa:facebook:${origin}:${workspace}`;
 let result=await zernioRequest(env,'profiles?externalId='+encodeURIComponent(externalId)),profiles=(result.profiles||[]).filter(p=>p.externalId===externalId);
 if(!profiles.length){try{result=await zernioRequest(env,'profiles',{method:'POST',body:{name:'FlowNexa Facebook '+workspace,externalId}});profiles=[result.profile];}catch(e){if(e.status!==409)throw e;result=await zernioRequest(env,'profiles?externalId='+encodeURIComponent(externalId));profiles=(result.profiles||[]).filter(p=>p.externalId===externalId);}}
 if(profiles.length!==1||!oid(profiles[0]?._id)||profiles[0].externalId!==externalId)throw fail('facebook_provider_response',502);
 await env.DB.prepare('INSERT OR IGNORE INTO facebook_profiles(workspace_id,profile_id) VALUES(?,?)').bind(workspace,profiles[0]._id).run();
 row=await env.DB.prepare('SELECT profile_id FROM facebook_profiles WHERE workspace_id=?').bind(workspace).first();return row.profile_id;
}
export async function importInstagramGraph(env,workspace,body){
 await ensureFacebookSchema(env);
 const source=await env.DB.prepare('SELECT name,configuration FROM flows WHERE id=? AND workspace_id=?').bind(body.instagram_flow_id,workspace).first();if(!source)throw fail('facebook_source_not_found',404);
 let graph=null;try{graph=JSON.parse(source.configuration)?.graph;}catch{}if(!graph)throw fail('facebook_source_without_graph',409);
 const account=body.account_id?await env.DB.prepare('SELECT * FROM facebook_accounts WHERE id=? AND workspace_id=?').bind(body.account_id,workspace).first():await env.DB.prepare("SELECT * FROM facebook_accounts WHERE workspace_id=? AND status='connected' LIMIT 1").bind(workspace).first();
 if(!account||account.status!=='connected')throw fail('facebook_page_not_connected',409);
 const fields=facebookFlowInput({name:(typeof body.name==='string'&&body.name.trim()?body.name:source.name+' · Facebook').slice(0,100),trigger_type:body.trigger_type||'dm_any',keywords:body.keywords||[],response_kind:'graph',graph});
 const count=await env.DB.prepare('SELECT count(*) n FROM facebook_flows WHERE workspace_id=?').bind(workspace).first();if(count.n>=30)throw fail('facebook_flow_limit',409);
 const id=crypto.randomUUID();
 await env.DB.prepare('INSERT INTO facebook_flows(id,workspace_id,account_id,name,trigger_type,keywords,response_kind,response_text,graph,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,workspace,account.id,fields.name,fields.trigger_type,JSON.stringify(fields.keywords),fields.response_kind,fields.response_text,fields.graph,nowSeconds(),nowSeconds()).run();
 return safeFlow(await env.DB.prepare('SELECT * FROM facebook_flows WHERE id=?').bind(id).first());
}
// Publishing/pausing shared by the panel and agents: a flow must still validate when it goes live.
export async function setFacebookFlowEnabled(env,workspace,flowId,enabled){
 await ensureFacebookSchema(env);
 const flow=await env.DB.prepare('SELECT * FROM facebook_flows WHERE id=? AND workspace_id=?').bind(flowId,workspace).first();if(!flow)throw fail('facebook_flow_not_found',404);
 if(!enabled){await env.DB.batch([env.DB.prepare('UPDATE facebook_flows SET enabled=0,version=version+1,updated_at=? WHERE id=?').bind(nowSeconds(),flow.id),env.DB.prepare("UPDATE facebook_jobs SET status='cancelled',error='flow_paused' WHERE flow_id=? AND status IN ('pending','retry')").bind(flow.id)]);}
 else{
  if(!facebookSendsEnabled(env,workspace))throw fail('facebook_sends_disabled',409);
  const account=await env.DB.prepare('SELECT status FROM facebook_accounts WHERE id=?').bind(flow.account_id).first();if(account?.status!=='connected')throw fail('facebook_page_not_connected',409);
  facebookFlowInput({...flow,keywords:JSON.parse(flow.keywords),graph:flow.graph});
  if(flow.trigger_type.endsWith('_any')){const conflict=await env.DB.prepare('SELECT id FROM facebook_flows WHERE account_id=? AND trigger_type=? AND enabled=1 AND id<>?').bind(flow.account_id,flow.trigger_type,flow.id).first();if(conflict)throw fail('facebook_flow_conflict',409);}
  await env.DB.prepare('UPDATE facebook_flows SET enabled=1,version=version+1,published_at=?,updated_at=? WHERE id=?').bind(Date.now(),nowSeconds(),flow.id).run();
 }
 return safeFlow(await env.DB.prepare('SELECT * FROM facebook_flows WHERE id=?').bind(flow.id).first());
}
export async function facebookApi(request,env){
 const url=new URL(request.url),path=url.pathname,metaCallback=path==='/api/facebook/meta/callback',callback=path==='/api/facebook/callback'||metaCallback;let callbackWorkspace=null;
 const errorResponse=(code,status)=>{if(callback&&request.headers.get('accept')?.includes('text/html'))return new Response(null,{status:302,headers:{location:new URL('/app?facebook_error='+encodeURIComponent(code)+(callbackWorkspace?'&workspace='+encodeURIComponent(callbackWorkspace):'')+'#facebook',url.origin).href,'cache-control':'no-store','referrer-policy':'no-referrer'}});return J({error:code},status);};
 if(!env.DB)return J({error:'database_unavailable'},503);
 if(request.method!=='GET'&&!sameOrigin(request))return J({error:'invalid_origin'},403);
 const user=await getSessionUser(request,env);if(!user)return errorResponse('unauthorized',401);
 try{
  if(callback){
   if(request.method!=='GET')throw fail('method_not_allowed',405);
   if(env.FACEBOOK_CHANNEL_ENABLED!=='true')throw fail('facebook_not_available',404);
   await ensureFacebookSchema(env);const state=url.searchParams.get(metaCallback?'state':'fn_state');if(!state||state.length>200)throw fail('invalid_state',403);
   const hash=await sha(state+':'+cookieToken(request)),row=await env.DB.prepare('SELECT * FROM facebook_oauth_states WHERE state_hash=? AND expires_at>?').bind(hash,nowSeconds()).first();
   if(!row||row.user_id!==user.id)throw fail('invalid_state',403);callbackWorkspace=row.workspace_id;
   if(!facebookEnabled(env,row.workspace_id)||!await requireMembership(env.DB,user.id,row.workspace_id,['owner','admin']))throw fail('forbidden',403);
   const consumed=await env.DB.prepare('DELETE FROM facebook_oauth_states WHERE state_hash=? AND expires_at>?').bind(hash,nowSeconds()).run();if(!consumed.meta.changes)throw fail('state_used',403);
   if(!await facebookAccess(env,row.workspace_id))throw fail('billing_subscription_required',402);
   if(metaCallback){
    if(row.profile_id!=='meta')throw fail('invalid_state',403);
    if(url.searchParams.has('error'))throw fail(url.searchParams.get('error_reason')==='user_denied'?'facebook_authorization_denied':'facebook_authorization_failed',409);
    const code=url.searchParams.get('code');if(!code||code.length>2000)throw fail('facebook_authorization_failed',400);
    let pages;try{pages=await metaPagesFromCode(env,url.origin,code);}catch(e){console.warn(JSON.stringify({event:'facebook_meta_oauth_failed',workspace_id:row.workspace_id,error:e.message}));throw fail('facebook_authorization_failed',409);}
    if(!pages.length)throw fail('facebook_no_pages',409);
    await env.DB.prepare('INSERT INTO facebook_meta_pending(user_id,workspace_id,encrypted_pages,expires_at) VALUES(?,?,?,?) ON CONFLICT(user_id,workspace_id) DO UPDATE SET encrypted_pages=excluded.encrypted_pages,expires_at=excluded.expires_at').bind(user.id,row.workspace_id,await sealPages(env,pages),nowSeconds()+900).run();
    return new Response(null,{status:302,headers:{location:new URL('/app?facebook_select=1&workspace='+encodeURIComponent(row.workspace_id)+'#facebook',url.origin).href,'cache-control':'no-store','referrer-policy':'no-referrer'}});
   }
   if(url.searchParams.has('error')){
    const providerError=url.searchParams.get('error'),reason=url.searchParams.get('error_reason');
    const knownErrors=['no_facebook_pages','oauth_denied','account_limit_exceeded','profile_limit_exceeded','payment_required','facebook_pages_error','token_exchange_failed'];
    const knownReasons=['pages_permission_declined','no_pages_granted','granted_pages_not_listed'];
    const requestId=url.searchParams.get('request_id');
    console.warn(JSON.stringify({event:'facebook_oauth_failed',workspace_id:row.workspace_id,provider_error:knownErrors.includes(providerError)?providerError:'unknown_provider_error',reason:knownReasons.includes(reason)?reason:null,request_id:/^[a-zA-Z0-9_-]{1,100}$/.test(requestId||'')?requestId:null}));
    throw fail(providerError==='no_facebook_pages'?'facebook_no_pages':providerError==='oauth_denied'?'facebook_authorization_denied':['account_limit_exceeded','profile_limit_exceeded','payment_required'].includes(providerError)?'facebook_provider_limit':'facebook_authorization_failed',409);
   }
   const remoteId=url.searchParams.get('accountId');if(url.searchParams.get('connected')!=='facebook'||url.searchParams.get('profileId')!==row.profile_id||!oid(remoteId))throw fail('facebook_authorization_failed',400);
   const result=await zernioRequest(env,'accounts?'+new URLSearchParams({profileId:row.profile_id,platform:'facebook'}));
   const remote=result.accounts?.find(a=>a._id===remoteId&&profileId(a.profileId)===row.profile_id&&a.platform==='facebook');
   const name=remote?.displayName||remote?.username,nativeId=pageNativeId(remote?.platformUserId);
   if(!remote||remote.isActive!==true||remote.needsReconnection===true||remote.enabled===false||!nativeId||typeof name!=='string'||!name.trim()||name.length>200)throw fail('facebook_authorization_failed',409);
   const matches=(await env.DB.prepare('SELECT * FROM facebook_accounts WHERE remote_id=? OR native_id=?').bind(remoteId,nativeId).all()).results;
   if(matches.some(a=>a.workspace_id!==row.workspace_id||a.profile_id!==row.profile_id||a.remote_id!==remoteId||a.native_id!==nativeId))throw fail('facebook_page_already_connected',409);
   if(row.reconnect_id&&!matches.some(a=>a.id===row.reconnect_id))throw fail('facebook_page_identity_changed',409);
   const id=matches[0]?.id||crypto.randomUUID();
   // A pilot has one Page per workspace. Reconnect cannot replace it or republish flows.
   const different=await env.DB.prepare("SELECT id FROM facebook_accounts WHERE workspace_id=? AND id<>? LIMIT 1").bind(row.workspace_id,id).first();if(different)throw fail('facebook_pilot_page_limit',409);
   await env.DB.prepare("INSERT INTO facebook_accounts(id,workspace_id,remote_id,profile_id,native_id,name,status,created_at) VALUES(?,?,?,?,?,?,'connected',?) ON CONFLICT(remote_id) DO UPDATE SET name=excluded.name,status='connected' WHERE facebook_accounts.workspace_id=excluded.workspace_id AND facebook_accounts.native_id=excluded.native_id").bind(id,row.workspace_id,remoteId,row.profile_id,nativeId,name,nowSeconds()).run();
   return new Response(null,{status:302,headers:{location:new URL('/app?facebook_connected=1&workspace='+encodeURIComponent(row.workspace_id)+'#facebook',url.origin).href,'cache-control':'no-store','referrer-policy':'no-referrer'}});
  }
  const body=request.method==='GET'?{}:await payload(request);
  const workspace=request.method==='GET'?url.searchParams.get('workspace'):body.workspace_id;
  const member=await requireMembership(env.DB,user.id,workspace);if(!member)throw fail('forbidden',403);
  const manage=['owner','admin'].includes(member.role),enabled=facebookEnabled(env,workspace);
  if(path==='/api/facebook/status'&&request.method==='GET')return J({enabled,sends_enabled:facebookSendsEnabled(env,workspace),pilot:true,can_manage:manage,monthly_message_limit:facebookMonthlyLimit(env),description:'Facebook Pages e Messenger'});
  if(!enabled)throw fail('facebook_not_available',404);
  await ensureFacebookSchema(env);
  if(path==='/api/facebook/accounts'&&request.method==='GET')return J({accounts:(await env.DB.prepare('SELECT * FROM facebook_accounts WHERE workspace_id=? ORDER BY created_at').bind(workspace).all()).results.map(safeAccount)});
  if(path==='/api/facebook/flows'&&request.method==='GET')return J({flows:(await env.DB.prepare('SELECT * FROM facebook_flows WHERE workspace_id=? ORDER BY created_at DESC').bind(workspace).all()).results.map(safeFlow)});
  if(path==='/api/facebook/executions'&&request.method==='GET')return J({executions:(await env.DB.prepare('SELECT id,flow_id,status,error,attempt_at,completed_at FROM facebook_jobs WHERE workspace_id=? ORDER BY rowid DESC LIMIT 50').bind(workspace).all()).results});
  if(!manage)throw fail('forbidden',403);
  // New Pages connect directly through the FlowNexa Meta app; Pages already on Zernio reconnect there.
  // FACEBOOK_CONNECTION_PROVIDER=zernio routes new Pages through Zernio (approved app, paid per account)
  // until FlowNexa's own Meta app passes App Review; any other value prefers the free direct Meta path.
  if(path==='/api/facebook/connect'&&request.method==='GET'&&metaConfigured(env)&&env.FACEBOOK_CONNECTION_PROVIDER!=='zernio'){
   const reconnect=url.searchParams.get('reconnect_id'),existing=await env.DB.prepare('SELECT * FROM facebook_accounts WHERE workspace_id=? LIMIT 1').bind(workspace).first();
   if(!existing||reconnect&&reconnect===existing.id&&existing.provider==='meta'){
    if(existing&&!reconnect)throw fail('facebook_pilot_page_limit',409);
    if(!await facebookAccess(env,workspace))throw fail('billing_subscription_required',402);
    const state=crypto.randomUUID()+crypto.randomUUID(),hash=await sha(state+':'+cookieToken(request));
    await env.DB.prepare('INSERT INTO facebook_oauth_states(state_hash,user_id,workspace_id,profile_id,reconnect_id,expires_at) VALUES(?,?,?,?,?,?)').bind(hash,user.id,workspace,'meta',reconnect||null,nowSeconds()+600).run();
    return J({authorization_url:metaAuthorizationUrl(env,url.origin,state)});
   }
  }
  // Own Meta app (open to every customer without FlowNexa App Review), like Atenza's WhatsApp.
  if(path==='/api/facebook/byo/setup'&&request.method==='GET')return J({webhook_url:new URL('/webhooks/facebook',url.origin).href,verify_token:env.FACEBOOK_VERIFY_TOKEN||null,fields:['messages','messaging_postbacks','feed'],permissions:['pages_messaging','pages_manage_metadata','pages_read_engagement','pages_manage_engagement','pages_show_list']});
  if(path==='/api/facebook/byo'&&request.method==='POST'){
   if(!env.TOKEN_ENCRYPTION_KEY||!env.FACEBOOK_VERIFY_TOKEN)throw fail('facebook_not_configured',503);
   if(!await facebookAccess(env,workspace))throw fail('billing_subscription_required',402);
   if(typeof body.app_secret!=='string'||!/^[a-f0-9]{32}$/i.test(body.app_secret.trim()))throw fail('facebook_invalid_credentials');
   let page;try{page=await validateOwnApp(env,{page_id:String(body.page_id||'').trim(),page_token:String(body.page_token||'').trim()});}catch{throw fail('facebook_invalid_credentials');}
   const existing=await env.DB.prepare('SELECT * FROM facebook_accounts WHERE workspace_id=? LIMIT 1').bind(workspace).first();
   if(existing&&(existing.native_id!==page.id||existing.provider==='zernio'))throw fail('facebook_pilot_page_limit',409);
   const elsewhere=await env.DB.prepare('SELECT workspace_id FROM facebook_accounts WHERE native_id=? AND workspace_id<>?').bind(page.id,workspace).first();if(elsewhere)throw fail('facebook_page_already_connected',409);
   try{await subscribeMetaPage(env,page);}catch(e){console.warn(JSON.stringify({event:'facebook_byo_subscribe_failed',workspace_id:workspace,error:e.message}));throw fail('facebook_subscription_failed',409);}
   const token=await encryptToken(page.token,env.TOKEN_ENCRYPTION_KEY),secret=await encryptToken(body.app_secret.trim(),env.TOKEN_ENCRYPTION_KEY);
   if(existing)await env.DB.prepare("UPDATE facebook_accounts SET name=?,encrypted_token=?,encrypted_app_secret=?,provider='meta_byo',status='connected' WHERE id=?").bind(page.name,token,secret,existing.id).run();
   else await env.DB.prepare("INSERT INTO facebook_accounts(id,workspace_id,remote_id,profile_id,native_id,name,status,created_at,provider,encrypted_token,encrypted_app_secret) VALUES(?,?,?,?,?,?,'connected',?,'meta_byo',?,?)").bind(crypto.randomUUID(),workspace,'meta:'+page.id,'meta',page.id,page.name,nowSeconds(),token,secret).run();
   return J({connected:true,page:{id:page.id,name:page.name}});
  }
  if(path==='/api/facebook/meta/pages'&&request.method==='GET'){
   const pending=await env.DB.prepare('SELECT * FROM facebook_meta_pending WHERE user_id=? AND workspace_id=? AND expires_at>?').bind(user.id,workspace,nowSeconds()).first();
   return J({pages:pending?(await openPages(env,pending.encrypted_pages)).map(p=>({id:p.id,name:p.name})):[]});
  }
  if(path==='/api/facebook/meta/select'&&request.method==='POST'){
   if(!await facebookAccess(env,workspace))throw fail('billing_subscription_required',402);
   const pending=await env.DB.prepare('SELECT * FROM facebook_meta_pending WHERE user_id=? AND workspace_id=? AND expires_at>?').bind(user.id,workspace,nowSeconds()).first();if(!pending)throw fail('facebook_selection_expired',409);
   const page=(await openPages(env,pending.encrypted_pages)).find(p=>p.id===body.page_id);if(!page)throw fail('facebook_page_not_found',404);
   const existing=await env.DB.prepare('SELECT * FROM facebook_accounts WHERE workspace_id=? LIMIT 1').bind(workspace).first();
   if(existing&&(existing.native_id!==page.id||existing.provider!=='meta'))throw fail('facebook_pilot_page_limit',409);
   const elsewhere=await env.DB.prepare('SELECT workspace_id FROM facebook_accounts WHERE native_id=? AND workspace_id<>?').bind(page.id,workspace).first();if(elsewhere)throw fail('facebook_page_already_connected',409);
   try{await subscribeMetaPage(env,page);}catch(e){console.warn(JSON.stringify({event:'facebook_meta_subscribe_failed',workspace_id:workspace,error:e.message}));throw fail('facebook_subscription_failed',409);}
   const sealed=await encryptToken(page.token,env.TOKEN_ENCRYPTION_KEY);
   if(existing)await env.DB.prepare("UPDATE facebook_accounts SET name=?,encrypted_token=?,status='connected' WHERE id=?").bind(page.name,sealed,existing.id).run();
   else await env.DB.prepare("INSERT INTO facebook_accounts(id,workspace_id,remote_id,profile_id,native_id,name,status,created_at,provider,encrypted_token) VALUES(?,?,?,?,?,?,'connected',?,'meta',?)").bind(crypto.randomUUID(),workspace,'meta:'+page.id,'meta',page.id,page.name,nowSeconds(),sealed).run();
   await env.DB.prepare('DELETE FROM facebook_meta_pending WHERE user_id=? AND workspace_id=?').bind(user.id,workspace).run();
   return J({connected:true,page:{id:page.id,name:page.name}});
  }
  if(path==='/api/facebook/connect'&&request.method==='GET'){
   if(!env.ZERNIO_API_KEY||!env.ZERNIO_WEBHOOK_SECRET||!env.TOKEN_ENCRYPTION_KEY)throw fail('facebook_not_configured',503);
   if(!await facebookAccess(env,workspace))throw fail('billing_subscription_required',402);
   const reconnect=url.searchParams.get('reconnect_id');
   const existing=await env.DB.prepare('SELECT * FROM facebook_accounts WHERE workspace_id=? LIMIT 1').bind(workspace).first();
   if(existing&&(!reconnect||reconnect!==existing.id))throw fail('facebook_pilot_page_limit',409);
   if(reconnect&&!existing)throw fail('facebook_page_not_found',404);
   const profile=await findOrCreateProfile(env,workspace,url.origin);
   const state=crypto.randomUUID()+crypto.randomUUID(),hash=await sha(state+':'+cookieToken(request));
   await env.DB.prepare('INSERT INTO facebook_oauth_states(state_hash,user_id,workspace_id,profile_id,reconnect_id,expires_at) VALUES(?,?,?,?,?,?)').bind(hash,user.id,workspace,profile,reconnect||null,nowSeconds()+600).run();
   const redirect=new URL('/api/facebook/callback',url.origin);redirect.searchParams.set('fn_state',state);
   // Pages owned by a Meta business portfolio are only listed with business_management, which
   // the provider grants under its ads area; offered as an explicit retry after no_pages_granted.
   // A Page already authorized for this profile (e.g. callback failed after Meta consent) is linked through the
   // same validated callback instead of a new OAuth, which the provider would bill as another account.
   const adopt=!reconnect&&(await zernioRequest(env,'accounts?'+new URLSearchParams({profileId:profile,platform:'facebook'}))).accounts?.find(a=>a.platform==='facebook'&&a.isActive===true&&profileId(a.profileId)===profile&&oid(a._id));
   if(adopt){redirect.searchParams.set('connected','facebook');redirect.searchParams.set('profileId',profile);redirect.searchParams.set('accountId',adopt._id);return J({authorization_url:redirect.href});}
   const result=await zernioRequest(env,'connect/facebook?'+new URLSearchParams({profileId:profile,redirect_url:redirect.href,scopes:url.searchParams.get('business')==='1'?'comments,messaging,ads':'comments,messaging'}));
   let auth;try{auth=new URL(result.authUrl);}catch{throw fail('facebook_provider_response',502);}
   if(auth.protocol!=='https:'||auth.username||auth.password||!['zernio.com','www.zernio.com','facebook.com','www.facebook.com'].includes(auth.hostname))throw fail('facebook_provider_response',502);
   return J({authorization_url:auth.href});
  }
  const accountMatch=path.match(/^\/api\/facebook\/accounts\/([^/]+)\/disconnect$/);
  if(accountMatch&&request.method==='POST'){
   const account=await env.DB.prepare('SELECT * FROM facebook_accounts WHERE id=? AND workspace_id=?').bind(accountMatch[1],workspace).first();if(!account)throw fail('facebook_page_not_found',404);
   // Local disconnect is sufficient to stop only this Page; it never revokes a shared Meta grant.
   await env.DB.batch([
    env.DB.prepare("UPDATE facebook_accounts SET status='disconnected' WHERE id=?").bind(account.id),
    env.DB.prepare('UPDATE facebook_flows SET enabled=0,version=version+1 WHERE account_id=?').bind(account.id),
    env.DB.prepare("UPDATE facebook_jobs SET status='cancelled',error='account_disconnected' WHERE account_id=? AND status IN ('pending','retry')").bind(account.id)
   ]);return J({disconnected:true,remote_revoked:false});
  }
  // Reuses a conversation built in the Instagram node editor of the same workspace as a Facebook draft.
  if(path==='/api/facebook/flows/import'&&request.method==='POST'){
   if(!await facebookAccess(env,workspace))throw fail('billing_subscription_required',402);
   return J({flow:await importInstagramGraph(env,workspace,body)});
  }
  const match=path.match(/^\/api\/facebook\/flows\/([^/]+)(?:\/(publish|pause))?$/);
  if(request.method==='POST'&&(path==='/api/facebook/flows'||match)){
   if(!await facebookAccess(env,workspace))throw fail('billing_subscription_required',402);
   let flow=match?await env.DB.prepare('SELECT * FROM facebook_flows WHERE id=? AND workspace_id=?').bind(match[1],workspace).first():null;if(match&&!flow)throw fail('facebook_flow_not_found',404);
   const operation=match?.[2];
   if(operation==='pause'){await env.DB.batch([env.DB.prepare('UPDATE facebook_flows SET enabled=0,version=version+1,updated_at=? WHERE id=?').bind(nowSeconds(),flow.id),env.DB.prepare("UPDATE facebook_jobs SET status='cancelled',error='flow_paused' WHERE flow_id=? AND status IN ('pending','retry')").bind(flow.id)]);return J({flow:safeFlow(await env.DB.prepare('SELECT * FROM facebook_flows WHERE id=?').bind(flow.id).first())});}
   const accountId=flow?.account_id||body.account_id;const account=await env.DB.prepare('SELECT * FROM facebook_accounts WHERE id=? AND workspace_id=?').bind(accountId,workspace).first();if(!account||account.status!=='connected')throw fail('facebook_page_not_connected',409);
   if(flow&&(!Number.isSafeInteger(body.version)||body.version!==flow.version))throw fail('facebook_flow_changed',409);
   if(operation==='publish'){
    if(!facebookSendsEnabled(env,workspace))throw fail('facebook_sends_disabled',409);
    facebookFlowInput({...flow,keywords:JSON.parse(flow.keywords),graph:flow.graph});
    const updated=await env.DB.prepare('UPDATE facebook_flows SET enabled=1,version=version+1,published_at=?,updated_at=? WHERE id=? AND version=?').bind(Date.now(),nowSeconds(),flow.id,flow.version).run();if(!updated.meta.changes)throw fail('facebook_flow_changed',409);
   }else{
    const fields=facebookFlowInput(body),id=flow?.id||crypto.randomUUID();
    if(flow){if(body.account_id!==flow.account_id)throw fail('facebook_page_identity_changed',409);const result=await env.DB.prepare('UPDATE facebook_flows SET name=?,trigger_type=?,keywords=?,response_kind=?,response_text=?,graph=?,enabled=0,version=version+1,updated_at=? WHERE id=? AND version=?').bind(fields.name,fields.trigger_type,JSON.stringify(fields.keywords),fields.response_kind,fields.response_text,fields.graph,nowSeconds(),id,flow.version).run();if(!result.meta.changes)throw fail('facebook_flow_changed',409);}
    else{const count=await env.DB.prepare('SELECT count(*) n FROM facebook_flows WHERE workspace_id=?').bind(workspace).first();if(count.n>=30)throw fail('facebook_flow_limit',409);await env.DB.prepare('INSERT INTO facebook_flows(id,workspace_id,account_id,name,trigger_type,keywords,response_kind,response_text,graph,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,workspace,accountId,fields.name,fields.trigger_type,JSON.stringify(fields.keywords),fields.response_kind,fields.response_text,fields.graph,nowSeconds(),nowSeconds()).run();}
    flow={id};
   }
   return J({flow:safeFlow(await env.DB.prepare('SELECT * FROM facebook_flows WHERE id=?').bind(flow.id).first())});
  }
  throw fail('not_found',404);
 }catch(e){return errorResponse(e.status?e.message:'facebook_request_failed',e.status||502);}
}
