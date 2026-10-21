import {getSessionUser,requireMembership,sameOrigin,payload,respond,rateLimit} from '../identity.js';
import {ensureCommerceSchema} from './schema.js';
import {connectStore,safeStore,ownedStore,readStore,activateHooks,disconnectStore} from './service.js';
import {fail} from './http.js';
export async function commerceApi(request,env){
 try{
  const user=await getSessionUser(request,env);if(!user)return respond({error:'unauthorized'},401);
  const url=new URL(request.url),write=request.method!=='GET';if(write&&!sameOrigin(request))return respond({error:'forbidden_origin'},403);
  if(!['GET','POST'].includes(request.method))return respond({error:'method_not_allowed'},405);
  const body=write?await payload(request,18000):{},workspace=write?body.workspace_id:url.searchParams.get('workspace');
  if(!await requireMembership(env.DB,user.id,workspace,write?['owner','admin']:undefined))return respond({error:'forbidden'},403);
  await ensureCommerceSchema(env);const parts=url.pathname.split('/').filter(Boolean),id=parts[3],action=parts[4];
  if(!id&&request.method==='GET'){const stores=await env.DB.prepare('SELECT * FROM commerce_stores WHERE workspace_id=? ORDER BY created_at').bind(workspace).all();return respond({stores:stores.results.map(safeStore),oauth:{shopify:Boolean(env.SHOPIFY_CLIENT_ID&&env.SHOPIFY_CLIENT_SECRET),nuvemshop:Boolean(env.NUVEMSHOP_CLIENT_ID&&env.NUVEMSHOP_CLIENT_SECRET)}});}
  if(!id&&request.method==='POST'){
   if(!await rateLimit(request,env,'commerce_connect',user.email))throw fail('commerce_rate_limit',429);
   const n=await env.DB.prepare('SELECT count(*) n FROM commerce_stores WHERE workspace_id=?').bind(workspace).first();if(n.n>=20)throw fail('commerce_store_limit',409);
   return respond({store:await connectStore(env,workspace,body.provider,body.credentials)},201);
  }
  const store=await ownedStore(env,workspace,id);
  if(action==='query'&&write){if(!await rateLimit(request,env,'commerce_query',user.email))throw fail('commerce_rate_limit',429);return respond(await readStore(env,workspace,id,body.operation,body.input||{}));}
  if(action==='webhooks'&&write)return respond(await activateHooks(env,workspace,id,url.origin));
  if(action==='disconnect'&&write){const cleanup=await disconnectStore(env,workspace,id);return respond({disconnected:true,...cleanup});}
  if(action==='events'&&!write){const events=await env.DB.prepare('SELECT id,topic,status,received_at,error FROM commerce_events WHERE store_id=? ORDER BY received_at DESC LIMIT 30').bind(id).all();return respond({events:events.results});}
  if(action==='rules'&&!write){const rows=await env.DB.prepare('SELECT * FROM commerce_rules WHERE store_id=? AND workspace_id=?').bind(id,workspace).all();return respond({rules:rows.results});}
  if(action==='rules'&&write){
   if(!['product.created','cart.abandoned','order.updated'].includes(body.event_type)||typeof body.message!=='string'||!body.message.trim()||body.message.length>800)throw fail('commerce_invalid_rule');
   const account=await env.DB.prepare("SELECT id FROM instagram_accounts WHERE id=? AND workspace_id=? AND status='connected'").bind(body.account_id,workspace).first();if(!account)throw fail('commerce_channel_not_connected',409);
   const ruleId=body.id||crypto.randomUUID();if(body.id&&!await env.DB.prepare('SELECT id FROM commerce_rules WHERE id=? AND workspace_id=? AND store_id=?').bind(body.id,workspace,id).first())throw fail('not_found',404);
   if(!body.id&&(await env.DB.prepare('SELECT count(*) n FROM commerce_rules WHERE store_id=?').bind(id).first()).n>=10)throw fail('commerce_rule_limit',409);
   await env.DB.prepare('INSERT INTO commerce_rules(id,store_id,workspace_id,account_id,event_type,enabled,message,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,message=excluded.message WHERE commerce_rules.workspace_id=excluded.workspace_id AND commerce_rules.store_id=excluded.store_id').bind(ruleId,id,workspace,account.id,body.event_type,body.enabled===true?1:0,body.message.trim(),Date.now()).run();return respond({id:ruleId});
  }
  return respond({error:'not_found'},404);
 }catch(e){return respond({error:e.message?.startsWith('commerce_')?e.message:'commerce_request_failed'},e.status||503);}
}
