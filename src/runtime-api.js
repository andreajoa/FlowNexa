import {billingAccess} from './billing.js';
import {getSessionUser,requireMembership,respond as J,sameOrigin,payload} from './identity.js';
import {validateFlow,matchFlow} from './flow-runtime.js';
import {metaRequest,messagingReady} from './meta-client.js';
const editors=['owner','admin','editor'];
export async function runtimeApi(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(!env.DB)return J({error:'database_unavailable'},503);
 if(request.method!=='GET'&&!sameOrigin(request))return J({error:'invalid_origin'},403);
 const user=await getSessionUser(request,env);if(!user)return J({error:'unauthorized'},401);
 try{
  if(path==='/api/flows'){
   if(request.method==='GET'){
    const workspace=url.searchParams.get('workspace');if(!await requireMembership(env.DB,user.id,workspace))return J({error:'forbidden'},403);
    const rows=await env.DB.prepare('SELECT * FROM flows WHERE workspace_id=? ORDER BY created_at DESC,id').bind(workspace).all();return J({flows:rows.results});
   }
   if(request.method==='POST'){
    const b=await payload(request,24000);if(!await requireMembership(env.DB,user.id,b.workspace_id,editors))return J({error:'forbidden'},403);
    const account=await env.DB.prepare('SELECT id FROM instagram_accounts WHERE id=? AND workspace_id=?').bind(b.account_id,b.workspace_id).first();if(!account)return J({error:'account_not_found'},404);
    const valid=validateFlow(b.trigger_type,b.scope,b.configuration);if(!valid.ok)return J({error:valid.error},400);
    if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100)return J({error:'invalid_name'},400);
    const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration) VALUES (?,?,?,?,?,?,?)').bind(id,b.workspace_id,b.account_id,b.name.trim(),b.trigger_type,b.scope,JSON.stringify(b.configuration)).run();return J({flow:await env.DB.prepare('SELECT * FROM flows WHERE id=?').bind(id).first()},201);
   }
  }
  const f=path.match(/^\/api\/flows\/([^/]+)(?:\/(publish|pause|simulate))?$/);
  if(f){
   const flow=await env.DB.prepare('SELECT * FROM flows WHERE id=?').bind(f[1]).first();if(!flow||!await requireMembership(env.DB,user.id,flow.workspace_id,request.method==='GET'?undefined:editors))return J({error:'not_found'},404);
   if(request.method==='GET'&&!f[2])return J({flow});
   if(request.method==='PATCH'&&!f[2]){
    const b=await payload(request,24000),config=b.configuration??JSON.parse(flow.configuration),trigger=b.trigger_type??flow.trigger_type,scope=b.scope??flow.scope;
    const valid=validateFlow(trigger,scope,config);if(!valid.ok)return J({error:valid.error},400);
    const name=b.name??flow.name;if(typeof name!=='string'||!name.trim()||name.length>100)return J({error:'invalid_name'},400);
    if(b.account_id&&b.account_id!==flow.account_id)return J({error:'account_change_not_supported'},400);
    await env.DB.prepare('UPDATE flows SET name=?,trigger_type=?,scope=?,configuration=?,enabled=0,version=version+1 WHERE id=?').bind(name.trim(),trigger,scope,JSON.stringify(config),flow.id).run();return J({flow:await env.DB.prepare('SELECT * FROM flows WHERE id=?').bind(flow.id).first()});
   }
   if(request.method==='POST'&&f[2]==='simulate'){
    const b=await payload(request);const kind=(b.trigger_type||flow.trigger_type).startsWith('comment')?'comment':(b.trigger_type||flow.trigger_type)==='story_reply'?'story':'dm';return J(matchFlow(flow,{kind,text:typeof b.text==='string'?b.text:'',media_id:b.media_id||''}));
   }
   if(request.method==='POST'&&['publish','pause'].includes(f[2])){
    if(f[2]==='publish'){
     if(!await billingAccess(env,flow.workspace_id))return J({error:'billing_subscription_required'},402);
     if(!messagingReady(env))return J({error:'messaging_not_configured'},503);
     const account=await env.DB.prepare('SELECT * FROM instagram_accounts WHERE id=?').bind(flow.account_id).first();if(!account||account.status!=='connected'||account.token_expires_at<Date.now()/1000)return J({error:'account_reconnect_required'},409);
     const valid=validateFlow(flow.trigger_type,flow.scope,JSON.parse(flow.configuration));if(!valid.ok)return J({error:valid.error},400);
    }
    await env.DB.prepare('UPDATE flows SET enabled=?,version=version+1 WHERE id=?').bind(f[2]==='publish'?1:0,flow.id).run();return J({flow:await env.DB.prepare('SELECT * FROM flows WHERE id=?').bind(flow.id).first()});
   }
  }
  const a=path.match(/^\/api\/accounts\/([^/]+)\/(media|disconnect)$/);
  if(a){
   const account=await env.DB.prepare('SELECT * FROM instagram_accounts WHERE id=?').bind(a[1]).first();if(!account||!await requireMembership(env.DB,user.id,account.workspace_id,a[2]==='disconnect'?['owner','admin']:undefined))return J({error:'not_found'},404);
   if(a[2]==='media'&&request.method==='GET'){const data=await metaRequest(env,account,`${account.ig_user_id}/media?fields=id,caption,media_type,permalink,thumbnail_url,media_url&limit=50`);return J({media:Array.isArray(data.data)?data.data:[]});}
   if(a[2]==='disconnect'&&request.method==='POST'){
    // Disable locally first, even if the provider is temporarily unreachable.
    await env.DB.batch([env.DB.prepare('UPDATE flows SET enabled=0,version=version+1 WHERE account_id=?').bind(account.id),env.DB.prepare("UPDATE instagram_accounts SET status='disconnected',encrypted_token=NULL,token_expires_at=NULL WHERE id=?").bind(account.id)]);
    try{await metaRequest(env,account,'me/subscribed_apps',{method:'DELETE'});}catch{}
    return J({ok:true});
   }
  }
  if(path==='/api/executions'&&request.method==='GET'){
   const workspace=url.searchParams.get('workspace');if(!await requireMembership(env.DB,user.id,workspace))return J({error:'forbidden'},403);
   const rows=await env.DB.prepare('SELECT j.id,j.flow_id,f.name AS flow_name,j.status,j.error,j.provider_id,j.action_type,j.attempt_at,j.completed_at FROM automation_jobs j JOIN flows f ON f.id=j.flow_id WHERE j.workspace_id=? ORDER BY j.rowid DESC LIMIT 100').bind(workspace).all();return J({executions:rows.results});
  }
  return J({error:'not_found'},404);
 }catch(error){if(error.status)return J({error:error.message},error.status);if(error instanceof SyntaxError)return J({error:'invalid_payload'},400);return J({error:['account_reconnect_required','meta_rate_limited','meta_request_rejected'].includes(error.message)?error.message:'request_failed'},502);}
}
